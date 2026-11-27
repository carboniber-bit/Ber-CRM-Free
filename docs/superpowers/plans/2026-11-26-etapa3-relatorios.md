# Etapa 3 — Relatórios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This execution does not dispatch subagents.

**Goal:** Construir a página Relatórios da Etapa 3 com seis visões auditáveis, filtros consistentes, agregações seguras no Supabase e exports CSV completos e cursorizados.

**Architecture:** A rota e os gráficos são carregados sob demanda; a página consulta uma RPC por visão e mantém um snapshot atômico com descarte de respostas obsoletas. A migration `0010` expõe views `security_invoker` e RPCs de leitura `security invoker` com `search_path = ''`, preservando RLS e grants mínimos. Exports detalhados e consolidados usam cursor keyset, páginas de no máximo 1.000 linhas e somente geram o arquivo após a leitura integral.

**Tech Stack:** React 19.3.1, TypeScript 7.0.2, Vite 8.3.6, React Router 7.18.6, Tailwind CSS v4, Supabase JS 2.119.2, PostgreSQL/PostgREST, Recharts 3.11.0, PapaParse 5.7.1, Vitest 5.1.1, Testing Library 16.3.3 e jsdom 31.0.1.

**Spec:** `docs/superpowers/specs/2026-11-26-etapa3-finalizacao-design.md`

## Global Constraints

- Preservar integralmente os Planos 1–3 e seus artefatos já commitados; este plano os consome e nunca os reescreve.
- Não iniciar a implementação se `0008_etapa3_projects.sql`, `0009_etapa3_finance.sql`, os tipos de cliente/projeto/financeiro e os serviços correspondentes não existirem no HEAD.
- Aplicar as migrations `0001`–`0009` somente em Supabase local descartável antes de aplicar `0010`; nunca alterar SQL remoto.
- Não usar service role, APIs pagas, push, deploy ou dados fictícios apresentados como dados reais.
- Períodos são datas locais inclusivas em `America/Sao_Paulo`; a RPC recebe início UTC inclusivo e fim UTC exclusivo.
- Coortes usam data de criação; eventos usam seu próprio timestamp; snapshots comerciais são rotulados como snapshot.
- Conversão de lead é exclusivamente `lead_client_links.converted_at`; nunca inferir conversão apenas de `leads.status = 'aceitou'`.
- Recebido líquido vem exclusivamente de `financial_payments`; `leads.received_value` não é fonte de receita.
- Taxas retornam `null` quando o denominador é zero; amostra insuficiente permanece visível como contagem e aviso, sem conclusão percentual.
- Rankings exigem ao menos 3 registros; conclusão de taxa exige denominador de ao menos 5.
- Toda RPC nova é `security invoker`, `set search_path = ''`, usa objetos qualificados e concede `EXECUTE` apenas a `authenticated`.
- Toda view nova usa `security_invoker = true`; não conceder acesso a `anon` ou `public`.
- Dinheiro no TypeScript é centavos inteiro seguro; no PostgreSQL, colunas permanecem `numeric(14,2)` e acumuladores usam `numeric`.
- Nenhuma consulta sem paginação é adicionada; listas de atenção/histórico são limitadas e indicam truncamento.
- Consultas independentes usam `Promise.all`; exportações cursorizadas são sequenciais porque cada página depende do cursor anterior.
- CSV usa UTF-8 com BOM, `;`, CRLF, cabeçalhos pt-BR, datas `DD/MM/AAAA`, timestamps `DD/MM/AAAA HH:mm`, dinheiro com duas casas e proteção contra fórmulas.
- O CSV atual de Leads em `src/lib/csv.ts` permanece intacto; Relatórios usa o formato novo em `src/lib/reports.ts`.
- Lazy loading obrigatório para `/relatorios`, para o módulo de gráficos de Relatórios e para o Recharts do Dashboard.
- Estados de carregamento, vazio e erro são explícitos; falha de atualização preserva o último snapshot válido sem misturar escopos.
- Commits frequentes são passos futuros deste plano; o commit final ocorre somente após o gate completo.
- Não criar Etapa 4 nem alterar a navegação ou as páginas ainda não implementadas dos módulos Clientes, Projetos e Financeiro.

## Arquitetura e decisões de domínio

### Portão de dependências

A Task 1 verifica no HEAD todos os artefatos abaixo. Se qualquer item faltar, a execução para com uma mensagem explícita; o executor conclui o Plano 1, 2 ou 3 correspondente em um trabalho separado e só então retorna aqui.

| Fundação | Evidência obrigatória |
| --- | --- |
| Clientes | `supabase/migrations/0006_etapa3_clients.sql`, `src/types/client.ts`, `src/services/clientService.ts`, `convert_lead_to_client` e `create_client` |
| Projetos | `supabase/migrations/0008_etapa3_projects.sql`, `ProjectTask`, `ProjectRevision`, `src/lib/projectProgress.ts` com `calculateProjectProgress` e `src/services/projectService.ts` |
| Financeiro | `supabase/migrations/0009_etapa3_finance.sql`, `src/types/finance.ts`, `src/lib/finance.ts`, `src/services/financialService.ts` e `financial_to_cents` |
| Schema local | migrations `0001`–`0009` aplicadas em banco local descartável |

### Matriz de filtros

`period`, `niche`, `city` e `service` aplicam-se às seis visões. `status` usa o domínio canônico da visão e é desabilitado em Financeiro e Consolidado porque os domínos de status são incompatíveis.

| Visão | Base do período | Snapshot | Eventos | Status | Serviço |
| --- | --- | --- | --- | --- | --- |
| Prospecção | coorte `leads.created_at` | status atual da coorte | contatos/respostas/conversões no período | `LEAD_STATUSES` | `leads.offered_service` |
| Oportunidades | coorte `leads.created_at` | elegibilidade, presença digital e valores do lead | conversões e recebimentos do ledger no período | `LEAD_STATUSES` | `leads.offered_service` |
| Clientes | novos clientes e conversões no período | total/status/projetos/pendências atuais | histórico no período | `CLIENT_STATUSES` | contrato mais recente do cliente |
| Projetos | coorte `projects.created_at` e produtividade por `completed_at` | status, atraso e atenção atuais | conclusões no período | `PROJECT_STATUSES` | `projects.service` |
| Financeiro | recebimentos, estornos e despesas pagas no período | contratado ativo, pendências e vencidos atuais | caixa por data efetiva | desabilitado | contrato/projeto relacionado |
| Consolidado | fatos por seu timestamp no período | totais exatos do recorte | movimentos financeiros realizados | desabilitado | serviço válido de cada fato |

Quando `niche`, `city` ou `service` está ativo, fatos sem vínculo dimensionável permanecem nos totais gerais somente se nenhum desses filtros estiver ativo. Com filtro dimensional ativo, fatos sem esse vínculo são excluídos e a interface informa que despesas sem contrato/projeto não podem ser atribuídas a nicho, cidade ou serviço.

### Semântica dos indicadores

- Prospecção: contato é atividade `primeiro_contato`, `mensagem` ou `ligacao`; resposta é atividade `resposta`; total de contatos conta eventos, não leads.
- Taxa de resposta = leads distintos com resposta / leads distintos com contato. Se houver resposta sem contato identificável, o aviso explica que a taxa pode superar 100%.
- Conversão da coorte = leads da coorte com vínculo convertido no período / total da coorte.
- Oportunidade = lead com `needs` não vazio e status fora de `aceitou`, `perdido` e `nao_interessado`, sem recalcular score ou alterar registros.
- Instagram sem site separa `has_website = 'no'` de `has_website = 'unverified'`; `has_instagram` deve ser `yes`.
- Cliente convertido usa o nicho do vínculo mais recente por `converted_at`; cliente manual usa `clients.niche`; ausência vira `Não informado`.
- Em projeto = existe projeto não cancelado e não concluído/entregue. Pendência = saldo de contrato ativo maior que zero.
- Atraso de projeto = `due_date` anterior a hoje em São Paulo e status fora de `completed`, `delivered` e `cancelled`.
- Prazo médio = `completed_at - start_date` somente quando ambos existem; sem amostra retorna `null`.
- Conclusão = concluídos/entregues da coorte / coorte não cancelada.
- Financeiro: contratado ativo exclui cancelados; recebido líquido = recebimentos − estornos; pendente nunca negativo; despesas canceladas ficam fora.
- Lucro realizado do período = recebido líquido do período − despesas pagas. Saldo acumulado inclui movimentos anteriores a `p_start`.
- Consolidado nunca soma joins um-para-muitos: a view de fatos materializa uma linha por lead, cliente, projeto, contrato ativo, pagamento e despesa paga.

### Contrato de exportação

- Módulos: `leads`, `opportunities`, `clients`, `projects`, `receipts`, `expenses` e `consolidated`.
- Cursor detalhado: `{ scope, occurredAt, id }`; cursor consolidado: `{ scope, bucket, niche, city, service }`.
- `scope` é `md5` determinístico do módulo, limites em microssegundos UTC e filtros; cursor de outro escopo é rejeitado.
- Ordenação detalhada: `(occurred_at, id)` ASC. Ordenação consolidada: `(bucket_start, niche, city, service)` ASC.
- `p_limit` aceito entre 1 e 1.000. A RPC conta o conjunto completo e aborta com SQLSTATE `22023` se houver mais de 10.000 registros.
- O cursor aponta sempre para a última linha retornada; `next_row` é apenas lookahead. O cliente acumula todas as páginas, detecta cursor repetido e só cria o Blob quando `next_cursor = null` e `rows.length === total`.
- Falha em qualquer página não baixa arquivo parcial. O teste de mutação insere um registro posterior ao cursor e comprova que as páginas seguintes não deslocam nem duplicam as anteriores.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/types/report.ts` | Contratos das seis visões, filtros, grupos, taxas, cursores e exports |
| `src/lib/reports.ts` | Períodos São Paulo, filtros, taxas, formatação e CSV de Relatórios |
| `src/lib/reports.test.ts` | Testes unitários de período, filtros, taxas, dinheiro e CSV |
| `supabase/migrations/0010_etapa3_reports.sql` | Views invoker, índices, RPCs agregadas e export cursorizado |
| `supabase/tests/etapa3_reports.sql` | Contratos SQL, isolamento RLS, métricas e exports |
| `src/services/reportService.ts` | Chamadas Supabase, validação dos payloads e paginação do export |
| `src/services/reportService.test.ts` | Contratos de RPC, parsers, erros e cursor |
| `src/hooks/useReportData.ts` | Snapshot atômico, versão de requisição e descarte de resposta obsoleta |
| `src/hooks/useReportData.test.tsx` | Concorrência, unmount, retry e preservação do snapshot |
| `src/components/reports/ReportFiltersBar.tsx` | Filtros compartilhados e controles inaplicáveis |
| `src/components/reports/ReportMetric.tsx` | Indicadores numéricos, monetários e taxas com amostra |
| `src/components/reports/ReportCharts.tsx` | Módulo lazy com Recharts e tabelas acessíveis |
| `src/components/reports/ReportViewContent.tsx` | Conteúdo literal das seis visões |
| `src/components/reports/ReportExportButton.tsx` | Seleção do módulo, progresso, erro e download final |
| `src/components/reports/ReportsPageStates.tsx` | Loading, vazio e erro reutilizáveis |
| `src/components/reports/ReportComponents.test.tsx` | Filtros, taxas, estados, export e módulo lazy de gráficos |
| `src/pages/ReportsPage.tsx` | Composição da página, filtros, snapshot e exports |
| `src/pages/ReportsPage.test.tsx` | Integração das seis visões com serviços mockados |
| `src/components/dashboard/DashboardCharts.tsx` | Gráficos atuais do Dashboard extraídos para módulo lazy |
| `src/routes/AppRoutes.tsx` | Rota `/relatorios` lazy; demais rotas preservadas |
| `src/routes/AppRoutes.test.tsx` | Prova da rota lazy e dos módulos ainda não implementados |
| `src/pages/DashboardPage.tsx` | Consome `DashboardCharts` via `lazy`/`Suspense` |
| `src/pages/DashboardPage.test.tsx` | Aguarda o módulo lazy e preserva todos os testes atuais |

---

### Task 1: Verificar a fundação e criar os contratos de Relatórios

**Arquivos:**
- Criar: `src/types/report.ts`
- Criar: `src/types/report.test.ts`

**Interfaces:**
- Consome `CLIENT_STATUSES`, `LEAD_STATUSES`, `NICHES`, `PROJECT_STATUSES` e os contratos financeiros dos Planos 1–3.
- Produz `ReportView`, `ReportFilters`, `ReportData`, `ReportExportCursor`, `ReportExportPage` e `REPORT_VIEWS`.

- [ ] **Step 1: Executar o portão de dependências**

```bash
for file in \
  supabase/migrations/0006_etapa3_clients.sql \
  supabase/migrations/0008_etapa3_projects.sql \
  supabase/migrations/0009_etapa3_finance.sql \
  src/types/client.ts src/types/project.ts src/types/finance.ts \
  src/lib/finance.ts src/lib/projectProgress.ts src/services/clientService.ts \
  src/services/projectService.ts src/services/financialService.ts
do
  if [ ! -f "$file" ]; then
    printf 'Dependência ausente: %s. Conclua o Plano 1–3 correspondente antes de Relatórios.\n' "$file" >&2
    exit 1
  fi
done

grep -q 'export interface ProjectTask' src/types/project.ts
grep -q 'export interface ProjectRevision' src/types/project.ts
grep -q 'export function calculateProjectProgress' src/lib/projectProgress.ts
grep -q 'financial_to_cents' supabase/migrations/0009_etapa3_finance.sql
```

Comando: `npx supabase migration list --local`
Resultado esperado: `0001`–`0009` registradas no banco local. Se a lista não estiver completa, aplicar/resetar somente o banco local descartável antes de continuar.

- [ ] **Step 2: Escrever o teste RED dos contratos**

Criar `src/types/report.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NICHES } from './lead'
import { REPORT_VIEWS, reportGroupLabel, reportNiches, reportStatusLabel, reportStatusOptions } from './report'

describe('contratos de relatórios', () => {
  it('expõe exatamente as seis visões da especificação', () => {
    expect(REPORT_VIEWS).toEqual([
      'prospecting', 'opportunities', 'clients', 'projects', 'financial', 'consolidated',
    ])
  })

  it('usa o domínio de status canônico de cada visão', () => {
    expect(reportStatusOptions('prospecting')).toContain('novo')
    expect(reportStatusOptions('clients')).toContain('awaiting_payment')
    expect(reportStatusOptions('projects')).toContain('awaiting_approval')
    expect(reportStatusOptions('financial')).toBeNull()
    expect(reportStatusOptions('consolidated')).toBeNull()
  })

  it('reutiliza os nichos canônicos sem criar códigos paralelos', () => {
    expect(reportNiches()).toEqual(NICHES)
  })

  it('apresenta rótulos pt-BR sem perder o código canônico', () => {
    expect(reportStatusLabel('prospecting', 'contato_realizado')).toBe('Contato realizado')
    expect(reportStatusLabel('clients', 'awaiting_payment')).toBe('Aguardando pagamento')
    expect(reportStatusLabel('projects', 'in_development')).toBe('Em desenvolvimento')
    expect(reportStatusLabel('projects', 'status-desconhecido')).toBe('status-desconhecido')
    expect(reportGroupLabel('prospecting', 'niche', 'barbearia')).toBe('Barbearia')
    expect(reportGroupLabel('opportunities', 'need', 'site')).toBe('Precisa de site')
    expect(reportGroupLabel('opportunities', 'priority', 'media')).toBe('Média')
    expect(reportGroupLabel('clients', 'status', 'awaiting_payment')).toBe('Aguardando pagamento')
  })
})
```

Comando: `npm test -- src/types/report.test.ts`
Falha esperada: módulo `./report` ausente.

- [ ] **Step 3: Implementar os contratos literais**

Criar `src/types/report.ts`:

```ts
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS } from './client'
import { LEAD_STATUSES, NEED_LABELS, NICHES, NICHE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './lead'
import { PROJECT_STATUSES } from './project'

const PROJECT_STATUS_LABELS: Readonly<Record<string, string>> = {
  not_started: 'Não iniciado', planning: 'Planejamento', in_development: 'Em desenvolvimento',
  awaiting_client_info: 'Aguardando informações do cliente', in_review: 'Em revisão',
  awaiting_approval: 'Aguardando aprovação', changes_requested: 'Alterações solicitadas',
  completed: 'Concluído', delivered: 'Entregue', cancelled: 'Cancelado',
}

export const REPORT_VIEWS = [
  'prospecting', 'opportunities', 'clients', 'projects', 'financial', 'consolidated',
] as const

export type ReportView = typeof REPORT_VIEWS[number]

export type ReportPeriod =
  | 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'previous_month'
  | 'last_3_months' | 'last_6_months' | 'this_year' | 'previous_year' | 'custom'

export interface ReportFilters {
  period: ReportPeriod
  startDate?: string
  endDate?: string
  niche?: string
  city?: string
  status?: string
  service?: string
}

export interface ResolvedReportPeriod {
  startDate: string
  endDate: string
  startAt: string
  endAt: string
  bucket: 'day' | 'week' | 'month'
}

export interface ReportMeta {
  generatedAt: string
  startDate: string
  endDate: string
  startAt: string
  endAt: string
  filters: ReportFilters
  warnings: string[]
}

export interface ReportRate {
  numerator: number
  denominator: number
  value: number | null
  sufficient: boolean
}

export interface ReportGroup {
  key: string
  label: string
  count: number
  amountCents?: number
  rate?: ReportRate
  rank?: number | null
}

export interface ReportSeriesPoint {
  bucket: string
  label: string
  count: number
  numerator?: number
  denominator?: number
  rate?: ReportRate
  amountCents?: number
}

export interface ProspectingReport {
  meta: ReportMeta
  cohort: { total: number }
  events: {
    contacts: number
    contactedLeads: number
    responses: number
    respondedLeads: number
    conversions: number
  }
  rates: { response: ReportRate; conversion: ReportRate }
  series: ReportSeriesPoint[]
  byStatus: ReportGroup[]
  byNiche: ReportGroup[]
  byCity: ReportGroup[]
  byService: ReportGroup[]
  ranking: ReportGroup[]
}

export interface OpportunitiesReport {
  meta: ReportMeta
  totalLeads: number
  qualified: number
  notProspected: number
  instagramWithoutSiteConfirmed: number
  instagramWithoutSiteUnverified: number
  estimatedCents: number
  negotiatedCents: number
  contractedSnapshotCents: number
  receivedLedgerCents: number
  conversionRate: ReportRate
  byNiche: ReportGroup[]
  byNeed: ReportGroup[]
  byPriority: ReportGroup[]
  byCity: ReportGroup[]
  byState: ReportGroup[]
  byService: ReportGroup[]
  ranking: ReportGroup[]
}

export interface ReportHistoryEntry {
  id: string
  clientId: string
  clientName: string
  type: string
  description: string
  createdAt: string
  source: 'client' | 'lead' | 'contract'
}

export interface ClientsReport {
  meta: ReportMeta
  total: number
  active: number
  inactive: number
  inProject: number
  pendingPayment: number
  pendingCents: number
  newInPeriod: number
  conversionsInPeriod: number
  series: ReportSeriesPoint[]
  byStatus: ReportGroup[]
  byNiche: ReportGroup[]
  byCity: ReportGroup[]
  byService: ReportGroup[]
  history: ReportHistoryEntry[]
  historyTruncated: boolean
}

export interface ReportAttentionItem {
  projectId: string
  projectName: string
  clientName: string
  service: string
  status: string
  dueDate: string | null
  reasons: string[]
}

export interface ProjectsReport {
  meta: ReportMeta
  total: number
  delayed: number
  averageDurationDays: number | null
  completionRate: ReportRate
  byStatus: ReportGroup[]
  productivity: ReportSeriesPoint[]
  attention: {
    total: number
    delayed: number
    pendingReview: number
    pendingApproval: number
    overdueTasks: number
    items: ReportAttentionItem[]
    truncated: boolean
  }
}

export interface ReportCashFlowPoint {
  label: string
  receiptsCents: number
  expensesCents: number
  netCents: number
  balanceCents: number
}

export interface ReportReceivable {
  contractId: string
  clientName: string
  service: string
  dueDate: string
  remainingCents: number
}

export interface FinancialReport {
  meta: ReportMeta
  contractedActiveCents: number
  receivedHistoricalCents: number
  pendingCents: number
  periodReceiptsCents: number
  periodRefundsCents: number
  periodNetReceiptsCents: number
  periodPaidExpensesCents: number
  pendingExpensesCents: number
  periodProfitCents: number
  overdueCents: number
  overdueExpensesCents: number
  cashFlow: ReportCashFlowPoint[]
  categories: Array<{ categoryId: string | null; name: string; amountCents: number }>
  paymentMethods: Array<{ method: string; receiptsCents: number; refundsCents: number }>
  overdue: ReportReceivable[]
  upcoming: ReportReceivable[]
  listsTruncated: boolean
}

export interface ReportCrossBucket {
  bucket: string
  niche: string
  city: string
  service: string
  leads: number
  clients: number
  projects: number
  movements: number
  receiptsCents: number
  refundsCents: number
  paidExpensesCents: number
  leadEstimatedCents: number
  leadNegotiatedCents: number
  leadContractedSnapshotCents: number
  contractContractedCents: number
  projectContractedCents: number
}

export interface ConsolidatedReport {
  meta: ReportMeta
  totals: {
    leads: number
    clients: number
    projects: number
    movements: number
    receiptsCents: number
    refundsCents: number
    paidExpensesCents: number
    netCents: number
    leadEstimatedCents: number
    leadNegotiatedCents: number
    leadContractedSnapshotCents: number
    contractContractedCents: number
    projectContractedCents: number
  }
  byPeriod: ReportCrossBucket[]
  byNiche: ReportCrossBucket[]
  byCity: ReportCrossBucket[]
  byService: ReportCrossBucket[]
  crossBuckets: ReportCrossBucket[]
  crossBucketsTruncated: boolean
  groupsTruncated: boolean
}

export type ReportData =
  | ProspectingReport
  | OpportunitiesReport
  | ClientsReport
  | ProjectsReport
  | FinancialReport
  | ConsolidatedReport

export interface ReportFilterOptions {
  cities: string[]
  services: string[]
}

export type ReportExportModule =
  | 'leads' | 'opportunities' | 'clients' | 'projects' | 'receipts' | 'expenses' | 'consolidated'

export type ReportExportRow = Record<string, string | number | null>

export type ReportExportCursor =
  | { scope: string; occurredAt: string; id: string }
  | { scope: string; bucket: string; niche: string; city: string; service: string }

export interface ReportExportPage {
  rows: ReportExportRow[]
  nextCursor: ReportExportCursor | null
  total: number
  generatedAt: string
}

export interface ReportExportFile {
  csv: string
  fileName: string
  total: number
}

export function reportStatusOptions(view: ReportView): readonly string[] | null {
  if (view === 'prospecting' || view === 'opportunities') return LEAD_STATUSES
  if (view === 'clients') return CLIENT_STATUSES
  if (view === 'projects') return PROJECT_STATUSES
  return null
}

export function reportNiches(): readonly string[] {
  return NICHES
}

export function reportNicheLabel(niche: string): string {
  return NICHE_LABELS[niche as keyof typeof NICHE_LABELS] ?? niche
}

export function reportStatusLabel(view: ReportView, status: string): string {
  const labels: Readonly<Record<string, string>> | null = view === 'clients'
    ? CLIENT_STATUS_LABELS
    : view === 'projects'
      ? PROJECT_STATUS_LABELS
      : view === 'prospecting' || view === 'opportunities'
        ? STATUS_LABELS
        : null
  return labels?.[status] ?? status
}

export type ReportGroupDimension = 'status' | 'niche' | 'need' | 'priority'

export function reportGroupLabel(view: ReportView, dimension: ReportGroupDimension, key: string): string {
  if (dimension === 'status') return reportStatusLabel(view, key)
  if (dimension === 'niche') return reportNicheLabel(key)
  if (dimension === 'need') return NEED_LABELS[key as keyof typeof NEED_LABELS] ?? key
  return PRIORITY_LABELS[key as keyof typeof PRIORITY_LABELS] ?? key
}
```

- [ ] **Step 4: Executar o teste GREEN e commitar**

Comando: `npm test -- src/types/report.test.ts`
Resultado esperado: quatro testes passando.

```bash
git add src/types/report.ts src/types/report.test.ts
git commit -m "feat: adicionar contratos dos relatórios da etapa 3"
```

---

### Task 2: Implementar períodos, filtros, taxas e CSV de Relatórios

**Arquivos:**
- Criar: `src/lib/reports.ts`
- Criar: `src/lib/reports.test.ts`

**Interfaces:**
- Consome `getSaoPauloToday` de `src/lib/finance.ts`.
- Produz `saoPauloLocalToUtc`, `resolveReportPeriod`, `normalizeReportFilters`, `reportFilterAvailability`, `calculateRate`, `formatReportDate`, `formatReportDateTime`, `formatReportMoney`, `buildReportCsv` e `reportExportFileName`.

- [ ] **Step 1: Escrever os testes RED**

Criar `src/lib/reports.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import {
  buildReportCsv, calculateRate, formatReportDate, formatReportDateTime,
  formatReportMoney, normalizeReportFilters, reportFilterAvailability,
  resolveReportPeriod, saoPauloLocalToUtc,
} from './reports'

describe('períodos de relatórios', () => {
  it('converte datas locais inclusivas para UTC com fim exclusivo', () => {
    expect(resolveReportPeriod({
      period: 'custom', startDate: '2026-11-25', endDate: '2026-11-25',
    }, new Date('2026-11-26T12:00:00Z'))).toEqual({
      startDate: '2026-11-25', endDate: '2026-11-25',
      startAt: '2026-11-25T03:00:00.000Z', endAt: '2026-11-26T03:00:00.000Z',
      bucket: 'day',
    })
  })

  it('respeita a mudança de horário histórica de São Paulo', () => {
    expect(saoPauloLocalToUtc('2018-11-03')).toBe('2018-11-03T03:00:00.000Z')
    expect(saoPauloLocalToUtc('2018-11-05')).toBe('2018-11-05T02:00:00.000Z')
    expect(() => saoPauloLocalToUtc('2018-11-04')).toThrow(/horário local inexistente/i)
  })

  it('calcula os presets a partir do dia local de referência', () => {
    const now = new Date('2026-11-25T18:00:00Z')
    expect(resolveReportPeriod({ period: 'today' }, now).endDate).toBe('2026-11-25')
    expect(resolveReportPeriod({ period: 'last_7_days' }, now).startDate).toBe('2026-11-19')
    expect(resolveReportPeriod({ period: 'previous_month' }, now)).toMatchObject({
      startDate: '2026-10-01', endDate: '2026-10-31',
    })
    expect(resolveReportPeriod({ period: 'this_year' }, now).startDate).toBe('2026-01-01')
    const january = new Date('2026-01-15T12:00:00Z')
    expect(resolveReportPeriod({ period: 'last_3_months' }, january).startDate).toBe('2025-11-01')
    expect(resolveReportPeriod({ period: 'last_6_months' }, january).startDate).toBe('2025-08-01')
    const february = new Date('2026-02-15T12:00:00Z')
    expect(resolveReportPeriod({ period: 'last_3_months' }, february).startDate).toBe('2025-12-01')
    expect(resolveReportPeriod({ period: 'last_6_months' }, february).startDate).toBe('2025-09-01')
  })

  it('rejeita período invertido e intervalo acima de 1095 dias', () => {
    expect(() => resolveReportPeriod({
      period: 'custom', startDate: '2026-11-26', endDate: '2026-11-25',
    })).toThrow(/inferior ou igual/i)
    expect(() => resolveReportPeriod({
      period: 'custom', startDate: '2020-01-01', endDate: '2026-01-01',
    })).toThrow(/1095/i)
    expect(resolveReportPeriod({
      period: 'custom', startDate: '2018-01-01', endDate: '2020-12-30',
    })).toMatchObject({ startDate: '2018-01-01', endDate: '2020-12-30', bucket: 'month' })
  })
})

describe('filtros e taxas', () => {
  it('normaliza códigos canônicos e remove status inaplicável', () => {
    expect(normalizeReportFilters('financial', {
      period: 'today', status: 'active', city: ' São Paulo ', service: ' Site ',
    })).toEqual({ period: 'today', city: 'São Paulo', service: 'Site' })
    expect(() => normalizeReportFilters('clients', {
      period: 'today', status: 'novo',
    })).toThrow(/status inválido/i)
    expect(() => normalizeReportFilters('prospecting', {
      period: 'today', niche: 'nicho inexistente',
    })).toThrow(/nicho inválido/i)
    expect(normalizeReportFilters('clients', {
      period: 'today', niche: ' pizzaria ', status: ' active ',
    })).toEqual({ period: 'today', niche: 'pizzaria', status: 'active' })
    expect(normalizeReportFilters('clients', {
      period: 'today', niche: '   ', city: '  ', service: '\t',
    })).toEqual({ period: 'today' })
  })

  it('desabilita status em Financeiro e Consolidado', () => {
    expect(reportFilterAvailability('financial').status).toBe(false)
    expect(reportFilterAvailability('consolidated').status).toBe(false)
    expect(reportFilterAvailability('projects').status).toBe(true)
  })

  it('retorna null no denominador zero e marca amostra insuficiente', () => {
    expect(calculateRate(0, 0)).toEqual({ numerator: 0, denominator: 0, value: null, sufficient: false })
    expect(calculateRate(1, 4)).toEqual({ numerator: 1, denominator: 4, value: 0.25, sufficient: false })
    expect(calculateRate(1, 5)).toEqual({ numerator: 1, denominator: 5, value: 0.2, sufficient: true })
  })
})

describe('CSV de relatórios', () => {
  it('formata datas e dinheiro no padrão brasileiro', () => {
    expect(formatReportDate('2026-11-25')).toBe('25/11/2026')
    expect(formatReportDate('2026-11-25T00:00:00')).toBe('25/11/2026')
    expect(formatReportDateTime('2026-11-25T12:30:00Z')).toBe('25/11/2026 09:30')
    expect(() => formatReportDateTime('2026-11-25T12:30:00')).toThrow(/sem fuso/i)
    expect(formatReportMoney(123456)).toBe('1.234,56')
    expect(formatReportMoney(-123456)).toBe('-1.234,56')
  })

  it('gera BOM, separador ponto e vírgula e proteção contra fórmulas', () => {
    const csv = buildReportCsv('leads', [{
      id: '00000000-0000-4000-8000-000000000001', name: '=1+1', created_at: '2026-11-25T12:30:00Z',
      estimated_value: 123456,
    }])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain(';')
    expect(csv).toContain('\r\n')
    expect(csv).toContain("'=1+1")
    expect(csv).toContain('1.234,56')
    const parsed = Papa.parse(csv.replace(/^\uFEFF/, ''), { delimiter: ';', header: true })
    expect(parsed.data[0]).toMatchObject({ Nome: "'=1+1", 'Valor estimado': '1.234,56' })
  })
})
```

Comando: `npm test -- src/lib/reports.test.ts`
Falha esperada: `./reports` ausente.

- [ ] **Step 2: Implementar as funções puras e o schema CSV**

Criar `src/lib/reports.ts`:

```ts
import Papa from 'papaparse'
import { getSaoPauloToday } from './finance'
import { reportNiches, reportStatusOptions } from '../types/report'
import type {
  ReportExportModule, ReportExportRow, ReportFilters, ReportRate, ReportView, ResolvedReportPeriod,
} from '../types/report'

export const REPORT_MAX_DAYS = 1095
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
const ZONED_TIMESTAMP_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i

function parseLocalDate(value: string): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(value)
  if (!match) throw new Error('Data inválida. Use AAAA-MM-DD.')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error('Data inválida. Use uma data existente.')
  }
  return { year, month, day }
}

function localDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addDays(value: string, amount: number): string {
  const { year, month, day } = parseLocalDate(value)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return localDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function monthStart(value: string, offset = 0): string {
  const { year, month } = parseLocalDate(value)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return localDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
}

function daysBetween(start: string, end: string): number {
  const a = parseLocalDate(start)
  const b = parseLocalDate(end)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}

const saoPauloFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function saoPauloParts(instant: Date): Record<string, number> {
  const result: Record<string, number> = {}
  for (const part of saoPauloFormatter.formatToParts(instant)) {
    if (part.type !== 'literal') result[part.type] = Number(part.value)
  }
  return result
}

export function saoPauloLocalToUtc(value: string): string {
  const target = parseLocalDate(value)
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day)
  let guess = targetAsUtc
  for (let index = 0; index < 4; index += 1) {
    const parts = saoPauloParts(new Date(guess))
    const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const next = targetAsUtc - (representedAsUtc - guess)
    if (next === guess) break
    guess = next
  }
  const actual = saoPauloParts(new Date(guess))
  if (actual.year !== target.year || actual.month !== target.month || actual.day !== target.day
    || actual.hour !== 0 || actual.minute !== 0 || actual.second !== 0) {
    throw new Error('Horário local inexistente nesta data em America/Sao_Paulo.')
  }
  return new Date(guess).toISOString()
}

export function resolveReportPeriod(filters: ReportFilters, now = new Date()): ResolvedReportPeriod {
  const today = getSaoPauloToday(now)
  let startDate = today
  let endDate = today
  switch (filters.period) {
    case 'today': break
    case 'last_7_days': startDate = addDays(today, -6); break
    case 'last_30_days': startDate = addDays(today, -29); break
    case 'this_month': startDate = monthStart(today); break
    case 'previous_month': {
      const currentMonth = monthStart(today)
      endDate = addDays(currentMonth, -1)
      startDate = monthStart(endDate)
      break
    }
    case 'last_3_months': startDate = monthStart(today, -2); break
    case 'last_6_months': startDate = monthStart(today, -5); break
    case 'this_year': startDate = `${today.slice(0, 4)}-01-01`; break
    case 'previous_year': {
      const year = Number(today.slice(0, 4)) - 1
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`
      break
    }
    case 'custom': {
      if (!filters.startDate || !filters.endDate) throw new Error('Informe as datas inicial e final.')
      startDate = filters.startDate
      endDate = filters.endDate
      break
    }
  }
  const inclusiveDays = daysBetween(startDate, endDate)
  if (inclusiveDays < 0) throw new Error('A data inicial deve ser menor ou igual à data final.')
  if (inclusiveDays + 1 > REPORT_MAX_DAYS) throw new Error('O período não pode exceder 1095 dias.')
  const span = inclusiveDays + 1
  return {
    startDate, endDate,
    startAt: saoPauloLocalToUtc(startDate),
    endAt: saoPauloLocalToUtc(addDays(endDate, 1)),
    bucket: span <= 31 ? 'day' : span <= 180 ? 'week' : 'month',
  }
}

export function reportFilterAvailability(view: ReportView) {
  return {
    period: true, niche: true, city: true, service: true,
    status: reportStatusOptions(view) !== null,
  }
}

export function normalizeReportFilters(view: ReportView, filters: ReportFilters): ReportFilters {
  const allowedStatuses = reportStatusOptions(view)
  const status = filters.status?.trim()
  if (status && allowedStatuses && !allowedStatuses.includes(status)) {
    throw new Error('Status inválido para a visão selecionada.')
  }
  const normalized: ReportFilters = { period: filters.period }
  if (filters.period === 'custom') {
    normalized.startDate = filters.startDate
    normalized.endDate = filters.endDate
  }
  if (filters.niche?.trim()) {
    const niche = filters.niche.trim()
    if (!reportNiches().includes(niche)) throw new Error('Nicho inválido para o relatório.')
    normalized.niche = niche
  }
  if (filters.city?.trim()) normalized.city = filters.city.trim()
  if (filters.service?.trim()) normalized.service = filters.service.trim()
  if (allowedStatuses && status) normalized.status = status
  return normalized
}

export function calculateRate(numerator: number, denominator: number): ReportRate {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0) {
    throw new Error('Numerador e denominador devem ser inteiros não negativos.')
  }
  return {
    numerator, denominator,
    value: denominator === 0 ? null : numerator / denominator,
    sufficient: denominator >= 5,
  }
}

export function formatReportDate(value: string | null): string {
  if (!value) return ''
  if (DATE_PATTERN.test(value) || LOCAL_TIMESTAMP_PATTERN.test(value)) {
    const { year, month, day } = parseLocalDate(value.slice(0, 10))
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  }
  return formatReportDateTime(value).slice(0, 10)
}

export function formatReportDateTime(value: string | null): string {
  if (!value) return ''
  if (!ZONED_TIMESTAMP_PATTERN.test(value)) throw new Error('Timestamp sem fuso recebido do banco.')
  const instant = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(instant.getTime())) throw new Error('Timestamp inválido recebido do banco.')
  const parts = saoPauloParts(instant)
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

export function formatReportMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Valor monetário inválido recebido do banco.')
  const absolute = Math.abs(cents)
  const integer = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cents < 0 ? '-' : ''}${integer},${String(absolute % 100).padStart(2, '0')}`
}

type CsvFormat = 'text' | 'date' | 'datetime' | 'money' | 'integer'
type CsvColumn = readonly [key: string, label: string, format: CsvFormat]

const ID = 'id'
const CREATED_AT = 'created_at'

export const REPORT_CSV_COLUMNS: Record<ReportExportModule, readonly CsvColumn[]> = {
  leads: [
    [ID, 'ID', 'text'], ['name', 'Nome', 'text'], ['niche', 'Nicho', 'text'], ['city', 'Cidade', 'text'],
    ['state', 'Estado', 'text'], ['status', 'Status', 'text'], ['offered_service', 'Serviço oferecido', 'text'],
    [CREATED_AT, 'Criado em', 'datetime'], ['updated_at', 'Atualizado em', 'datetime'],
    ['estimated_value', 'Valor estimado', 'money'], ['negotiated_value', 'Valor negociado', 'money'],
    ['contracted_value', 'Valor contratado (snapshot)', 'money'], ['needs', 'Necessidades', 'text'],
    ['priority', 'Prioridade', 'text'], ['has_website', 'Possui site', 'text'], ['has_instagram', 'Possui Instagram', 'text'],
    ['linked_client_id', 'Cliente vinculado', 'text'], ['converted_at', 'Convertido em', 'datetime'],
  ],
  opportunities: [
    [ID, 'ID', 'text'], ['name', 'Nome', 'text'], ['niche', 'Nicho', 'text'], ['city', 'Cidade', 'text'],
    ['state', 'Estado', 'text'], ['status', 'Status', 'text'], ['offered_service', 'Serviço oferecido', 'text'],
    [CREATED_AT, 'Criado em', 'datetime'], ['estimated_value', 'Valor estimado', 'money'],
    ['negotiated_value', 'Valor negociado', 'money'], ['contracted_value', 'Valor contratado (snapshot)', 'money'],
    ['needs', 'Necessidades', 'text'], ['priority', 'Prioridade', 'text'],
    ['has_website', 'Possui site', 'text'], ['has_instagram', 'Possui Instagram', 'text'],
    ['eligible', 'Elegível (1=sim, 0=não)', 'integer'],
  ],
  clients: [
    [ID, 'ID', 'text'], ['name', 'Nome', 'text'], ['niche', 'Nicho', 'text'], ['city', 'Cidade', 'text'],
    ['state', 'Estado', 'text'], ['status', 'Status', 'text'], ['source', 'Origem', 'text'],
    ['service', 'Serviço do contrato mais recente', 'text'], [CREATED_AT, 'Criado em', 'datetime'],
    ['converted_at', 'Convertido em', 'datetime'], ['linked_lead_id', 'Lead vinculado mais recente', 'text'],
  ],
  projects: [
    [ID, 'ID', 'text'], ['client_id', 'Cliente ID', 'text'], ['contract_id', 'Contrato ID', 'text'],
    ['source_link_id', 'Vínculo de origem ID', 'text'], ['name', 'Nome', 'text'], ['service', 'Serviço', 'text'],
    ['status', 'Status', 'text'], ['start_date', 'Início', 'date'], ['due_date', 'Prazo', 'date'],
    ['completed_at', 'Concluído em', 'datetime'], ['delivered_at', 'Entregue em', 'datetime'],
    [CREATED_AT, 'Criado em', 'datetime'], ['contracted_value', 'Valor contratado', 'money'],
  ],
  receipts: [
    [ID, 'ID', 'text'], ['contract_id', 'Contrato ID', 'text'], ['client_id', 'Cliente ID', 'text'],
    ['related_payment_id', 'Pagamento estornado ID', 'text'], ['type', 'Tipo', 'text'], ['amount', 'Valor', 'money'],
    ['received_at', 'Recebido em', 'datetime'], ['payment_method', 'Forma de pagamento', 'text'],
    ['service', 'Serviço', 'text'], ['niche', 'Nicho', 'text'], ['city', 'Cidade', 'text'],
  ],
  expenses: [
    [ID, 'ID', 'text'], ['client_id', 'Cliente ID', 'text'], ['contract_id', 'Contrato ID', 'text'],
    ['project_id', 'Projeto ID', 'text'], ['category_id', 'Categoria ID', 'text'], ['category_name', 'Categoria', 'text'],
    ['description', 'Descrição', 'text'], ['amount', 'Valor', 'money'], ['expense_date', 'Data da despesa', 'date'],
    ['due_date', 'Vencimento', 'date'], ['paid_at', 'Pago em', 'datetime'], ['status', 'Status', 'text'],
    ['payment_method', 'Forma de pagamento', 'text'], ['service', 'Serviço', 'text'],
    ['niche', 'Nicho', 'text'], ['city', 'Cidade', 'text'],
  ],
  consolidated: [
    ['bucket', 'Período', 'text'], ['niche', 'Nicho', 'text'], ['city', 'Cidade', 'text'], ['service', 'Serviço', 'text'],
    ['leads', 'Leads', 'integer'], ['clients', 'Clientes', 'integer'], ['projects', 'Projetos', 'integer'],
    ['movements', 'Movimentos', 'integer'], ['receipts_cents', 'Recebimentos', 'money'],
    ['refunds_cents', 'Estornos', 'money'], ['paid_expenses_cents', 'Despesas pagas', 'money'],
    ['lead_estimated_cents', 'Leads estimados', 'money'], ['lead_negotiated_cents', 'Leads negociados', 'money'],
    ['lead_contracted_cents', 'Leads contratados (snapshot)', 'money'],
    ['contract_contracted_cents', 'Contratos ativos', 'money'], ['project_contracted_cents', 'Projetos contratados', 'money'],
  ],
}

function csvValue(value: string | number | null, format: CsvFormat): string {
  if (value === null) return ''
  if (format === 'money') return formatReportMoney(Number(value))
  if (format === 'date') return formatReportDate(String(value))
  if (format === 'datetime') return formatReportDateTime(String(value))
  return String(value)
}

export function buildReportCsv(module: ReportExportModule, rows: ReportExportRow[]): string {
  const columns = REPORT_CSV_COLUMNS[module]
  return `\uFEFF${Papa.unparse({
    fields: columns.map(([, label]) => label),
    data: rows.map((row) => columns.map(([key, , format]) => csvValue(row[key] ?? null, format))),
  }, {
    delimiter: ';', newline: '\r\n', escapeFormulae: /^(?:[\t\r]|\s*[=+\-@])/,
  })}`
}

export function reportExportFileName(module: ReportExportModule, startDate: string, endDate: string): string {
  return `ber-relatorio-${module}-${startDate}-a-${endDate}.csv`
}
```

- [ ] **Step 3: Executar o teste GREEN e commitar**

Comando: `npm test -- src/lib/reports.test.ts`
Resultado esperado: todos os testes de período, DST, filtros, taxas e CSV passando.

```bash
git add src/lib/reports.ts src/lib/reports.test.ts
git commit -m "feat: adicionar regras puras e CSV dos relatórios"
```

---

### Task 3: Criar a base segura da migration 0010 e as views de dimensão

**Arquivos:**
- Criar: `supabase/migrations/0010_etapa3_reports.sql`
- Criar: `supabase/tests/etapa3_reports.sql`

**Interfaces:**
- Consome todas as tabelas e FKs compostas por owner das migrations `0002`, `0006`, `0008` e `0009`.
- Produz `report_require_session`, `report_validate_period`, `report_normalize_niche`, `report_bucket`, `report_buckets`, `report_rate`, `report_export_scope` e as views `report_client_dimensions`, `report_project_dimensions`, `report_financial_entries` e `report_consolidated_facts`.
- Preserva RLS: nenhuma view usa `security_definer` ou owner fixo.

- [ ] **Step 1: Escrever o teste SQL RED de schema e segurança**

Criar `supabase/tests/etapa3_reports.sql`:

```sql
-- supabase/tests/etapa3_reports.sql
begin;
savepoint etapa3_reports_schema;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
begin
  if (select count(*) from public.report_client_dimensions) <> 0 then
    raise exception 'A view de clientes vazou dados de outro owner.';
  end if;
  if (select count(*) from public.report_financial_entries) <> 0 then
    raise exception 'A view financeira vazou dados de outro owner.';
  end if;
  if (select count(*) from public.report_consolidated_facts) <> 0 then
    raise exception 'A view consolidada vazou dados de outro owner.';
  end if;
  if (select count(*) from public.report_buckets('2026-11-25T03:00:00Z'::timestamptz, '2026-11-28T03:00:00Z'::timestamptz)) <> 3 then
    raise exception 'Buckets diários incorretos.';
  end if;
  if public.report_bucket('2018-10-05T03:00:00Z'::timestamptz, '2018-11-05T02:00:00Z'::timestamptz) <> 'day' then
    raise exception 'Bucket de 31 dias locais divergiu por causa do horário de verão.';
  end if;
  perform public.report_validate_period('2018-01-01T03:00:00Z'::timestamptz, '2020-12-31T03:00:00Z'::timestamptz);
  begin
    perform public.report_validate_period('2018-01-01T03:00:00Z'::timestamptz, '2021-01-01T03:00:00Z'::timestamptz);
    raise exception 'Período de 1096 dias foi aceito.';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.report_validate_period('2026-11-25T03:00:00Z'::timestamptz, '2026-11-25T03:00:00Z'::timestamptz);
    raise exception 'Período vazio foi aceito.';
  exception when sqlstate '22023' then null;
  end;
  if public.report_normalize_niche(null) is not null
    or public.report_normalize_niche('   ') is not null
    or public.report_normalize_niche(' pizzaria ') <> 'pizzaria' then
    raise exception 'Normalização de nicho vazio ou canônico incorreta.';
  end if;
  begin
    perform public.report_normalize_niche('nicho inexistente');
    raise exception 'Nicho inválido foi aceito.';
  exception when sqlstate '22023' then null;
  end;
  if public.report_export_scope(
    'leads', '2026-11-20T03:00:00Z'::timestamptz, '2026-11-27T03:00:00Z'::timestamptz,
    null, 'a||b', null, 'c'
  ) = public.report_export_scope(
    'leads', '2026-11-20T03:00:00Z'::timestamptz, '2026-11-27T03:00:00Z'::timestamptz,
    null, 'a', null, 'b||c'
  ) then
    raise exception 'Escopo de exportação ambiguo com delimitadores nos filtros.';
  end if;
end;
$$;

reset role;

do $$
declare
  view_name text;
  function_name text;
  function_oid oid;
begin
  foreach view_name in array array[
    'report_client_dimensions', 'report_project_dimensions',
    'report_financial_entries', 'report_consolidated_facts'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = view_name
        and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
    ) then
      raise exception 'View % sem security_invoker.', view_name;
    end if;
    if pg_catalog.has_table_privilege('anon', format('public.%I', view_name), 'SELECT')
      or pg_catalog.has_table_privilege('authenticated', format('public.%I', view_name), 'SELECT') = false then
      raise exception 'Privilégio de SELECT inválido na view %.', view_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      cross join lateral pg_catalog.aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relname = view_name and a.grantee = 0
        and a.privilege_type = 'SELECT'
    ) then
      raise exception 'View % concedida a PUBLIC.', view_name;
    end if;
  end loop;

  foreach function_name in array array[
    'report_require_session', 'report_validate_period', 'report_normalize_niche',
    'report_bucket', 'report_buckets', 'report_rate', 'report_export_scope'
  ] loop
    select p.oid into function_oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = function_name
      and not p.prosecdef and 'search_path=""' = any(p.proconfig);
    if function_oid is null then
      raise exception 'Função % não é security invoker com search_path vazio.', function_name;
    end if;
    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE') then
      raise exception 'Privilégio de EXECUTE inválido na função %.', function_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(p.proacl) a
      where p.oid = function_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception 'Função % concedida a PUBLIC.', function_name;
    end if;
    function_oid := null;
  end loop;

  if to_regclass('public.leads_owner_created_sp_idx') is null
    or to_regclass('public.lead_activities_owner_created_sp_idx') is null
    or to_regclass('public.clients_owner_created_sp_idx') is null
    or to_regclass('public.projects_owner_completed_sp_idx') is null
    or to_regclass('public.project_tasks_owner_due_status_idx') is null then
    raise exception 'Índice obrigatório de relatórios ausente.';
  end if;
end;
$$;

rollback;
```

Comando: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql`
Falha esperada: `report_client_dimensions` não existe.

- [ ] **Step 2: Criar a migration com helpers, índices e views**

Criar `supabase/migrations/0010_etapa3_reports.sql`:

```sql
-- supabase/migrations/0010_etapa3_reports.sql
begin;

create index if not exists leads_owner_created_sp_idx
  on public.leads (owner_id, ((created_at at time zone 'America/Sao_Paulo')));
create index if not exists lead_activities_owner_created_sp_idx
  on public.lead_activities (owner_id, ((created_at at time zone 'America/Sao_Paulo')));
create index if not exists lead_activities_owner_type_created_idx
  on public.lead_activities (owner_id, type, created_at desc);
create index if not exists lead_client_links_owner_converted_idx
  on public.lead_client_links (owner_id, converted_at desc);
create index if not exists clients_owner_created_sp_idx
  on public.clients (owner_id, ((created_at at time zone 'America/Sao_Paulo')));
create index if not exists clients_owner_niche_idx
  on public.clients (owner_id, niche);
create index if not exists contracts_owner_service_idx
  on public.contracts (owner_id, service, status);
create index if not exists projects_owner_created_sp_idx
  on public.projects (owner_id, ((created_at at time zone 'America/Sao_Paulo')));
create index if not exists projects_owner_completed_sp_idx
  on public.projects (owner_id, ((completed_at at time zone 'America/Sao_Paulo')))
  where completed_at is not null;
create index if not exists project_tasks_owner_due_status_idx
  on public.project_tasks (owner_id, due_date, status)
  where status in ('pending', 'in_progress');
create index if not exists project_revisions_owner_status_project_idx
  on public.project_revisions (owner_id, status, project_id)
  where status in ('requested', 'in_progress');

create or replace function public.report_require_session()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada necessária.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.report_validate_period(p_start timestamptz, p_end timestamptz)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_local_days integer;
begin
  perform public.report_require_session();
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Período inválido: informe início anterior ao fim exclusivo.' using errcode = '22023';
  end if;
  if (p_start at time zone 'America/Sao_Paulo')::time <> time '00:00:00'
    or (p_end at time zone 'America/Sao_Paulo')::time <> time '00:00:00' then
    raise exception 'O período deve começar e terminar à meia-noite em America/Sao_Paulo.' using errcode = '22023';
  end if;
  v_local_days := ((p_end at time zone 'America/Sao_Paulo')::date
    - (p_start at time zone 'America/Sao_Paulo')::date);
  if v_local_days > 1095 then
    raise exception 'O período não pode exceder 1095 dias.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.report_normalize_niche(p_niche text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_niche text := nullif(pg_catalog.btrim(p_niche), '');
begin
  if v_niche is null then
    return null;
  end if;
  if not (v_niche = any (array[
    'barbearia', 'manicure', 'nail_designer', 'salao_beleza', 'restaurante',
    'pizzaria', 'hamburgueria', 'lanchonete', 'cafeteria', 'clinica_estetica',
    'comercio', 'outros'
  ])) then
    raise exception 'Nicho inválido para o relatório.' using errcode = '22023';
  end if;
  return v_niche;
end;
$$;

create or replace function public.report_bucket(p_start timestamptz, p_end timestamptz)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when ((p_end at time zone 'America/Sao_Paulo')::date
      - (p_start at time zone 'America/Sao_Paulo')::date) <= 31 then 'day'
    when ((p_end at time zone 'America/Sao_Paulo')::date
      - (p_start at time zone 'America/Sao_Paulo')::date) <= 180 then 'week'
    else 'month'
  end;
$$;

create or replace function public.report_buckets(p_start timestamptz, p_end timestamptz)
returns table (bucket_start timestamp, label text)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select public.report_bucket(p_start, p_end) as unit,
      pg_catalog.date_trunc(public.report_bucket(p_start, p_end), p_start at time zone 'America/Sao_Paulo') as first_bucket,
      pg_catalog.date_trunc(
        public.report_bucket(p_start, p_end),
        (p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo'
      ) as last_bucket
  )
  select series.bucket_start, pg_catalog.to_char(series.bucket_start, 'YYYY-MM-DD') as label
  from bounds b
  cross join lateral pg_catalog.generate_series(
    b.first_bucket,
    b.last_bucket,
    case b.unit
      when 'day' then interval '1 day'
      when 'week' then interval '7 days'
      else interval '1 month'
    end
  ) as series(bucket_start);
$$;

create or replace function public.report_rate(p_numerator bigint, p_denominator bigint)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select case when coalesce(p_denominator, 0) = 0 then null
    else p_numerator::numeric / p_denominator::numeric end;
$$;

create or replace function public.report_export_scope(
  p_module text,
  p_start timestamptz,
  p_end timestamptz,
  p_niche text,
  p_city text,
  p_status text,
  p_service text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.md5(pg_catalog.jsonb_build_array(
    p_module,
    pg_catalog.round(pg_catalog.extract(epoch from p_start) * 1000000)::bigint,
    pg_catalog.round(pg_catalog.extract(epoch from p_end) * 1000000)::bigint,
    coalesce(p_niche, ''), coalesce(p_city, ''), coalesce(p_status, ''), coalesce(p_service, '')
  )::text);
$$;

create or replace view public.report_client_dimensions
with (security_invoker = true)
as
select
  c.id as client_id,
  c.name as client_name,
  c.status,
  c.city,
  c.state,
  case when linked.lead_id is not null then linked.niche else c.niche end as niche,
  c.source,
  c.created_at,
  c.converted_at,
  latest_contract.service,
  linked.lead_id as linked_lead_id
from public.clients c
left join lateral (
  select lc.lead_id, l.niche
  from public.lead_client_links lc
  join public.leads l on l.id = lc.lead_id and l.owner_id = lc.owner_id
  where lc.owner_id = c.owner_id and lc.client_id = c.id
  order by lc.converted_at desc, lc.id desc
  limit 1
) linked on true
left join lateral (
  select ct.service
  from public.contracts ct
  where ct.owner_id = c.owner_id and ct.client_id = c.id
  order by ct.contracted_at desc, ct.created_at desc, ct.id desc
  limit 1
) latest_contract on true;

create or replace view public.report_project_dimensions
with (security_invoker = true)
as
select
  p.id as project_id,
  p.client_id,
  p.contract_id,
  p.source_link_id,
  p.name as project_name,
  p.service,
  p.status,
  p.start_date,
  p.due_date,
  p.completed_at,
  p.delivered_at,
  p.created_at,
  p.contracted_value,
  cd.client_name,
  cd.niche,
  cd.city,
  cd.state
from public.projects p
join public.report_client_dimensions cd on cd.client_id = p.client_id;

create or replace view public.report_financial_entries
with (security_invoker = true)
as
select
  'receipt'::text as kind,
  'posted'::text as status,
  p.id as entry_id,
  p.contract_id,
  null::uuid as project_id,
  ct.client_id,
  p.received_at as occurred_at,
  null::date as due_date,
  p.amount,
  p.payment_method,
  null::uuid as category_id,
  null::text as category_name,
  ct.service,
  cd.niche,
  cd.city,
  cd.state
from public.financial_payments p
join public.contracts ct on ct.id = p.contract_id and ct.owner_id = p.owner_id
join public.report_client_dimensions cd on cd.client_id = ct.client_id
where p.type = 'receipt'
union all
select
  'refund'::text,
  'posted'::text,
  p.id,
  p.contract_id,
  null::uuid,
  ct.client_id,
  p.received_at,
  null::date,
  p.amount,
  p.payment_method,
  null::uuid,
  null::text,
  ct.service,
  cd.niche,
  cd.city,
  cd.state
from public.financial_payments p
join public.contracts ct on ct.id = p.contract_id and ct.owner_id = p.owner_id
join public.report_client_dimensions cd on cd.client_id = ct.client_id
where p.type = 'refund'
union all
select
  'expense'::text,
  e.status,
  e.id,
  e.contract_id,
  e.project_id,
  coalesce(ct.client_id, pj.client_id),
  case when e.paid_at is not null then e.paid_at
    else (e.expense_date::timestamp at time zone 'America/Sao_Paulo') end,
  e.due_date,
  e.amount,
  e.payment_method,
  e.category_id,
  cat.name,
  coalesce(ct.service, pj.service),
  cd.niche,
  cd.city,
  cd.state
from public.financial_expenses e
left join public.contracts ct on ct.id = e.contract_id and ct.owner_id = e.owner_id
left join public.projects pj on pj.id = e.project_id and pj.owner_id = e.owner_id
left join public.expense_categories cat on cat.id = e.category_id and cat.owner_id = e.owner_id
left join public.report_client_dimensions cd on cd.client_id = coalesce(ct.client_id, pj.client_id);

create or replace view public.report_consolidated_facts
with (security_invoker = true)
as
select
  'lead'::text as entity_type,
  l.id as entity_id,
  l.created_at as occurred_at,
  l.niche,
  l.city,
  l.state,
  l.offered_service as service,
  l.status,
  l.estimated_value,
  l.negotiated_value,
  l.contracted_value,
  0::numeric as contract_value,
  0::numeric as project_value,
  0::numeric as receipt_value,
  0::numeric as refund_value,
  0::numeric as expense_value
from public.leads l
union all
select
  'client', c.client_id, c.created_at, c.niche, c.city, c.state, c.service, c.status,
  0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric
from public.report_client_dimensions c
union all
select
  'project', p.project_id, p.created_at, p.niche, p.city, p.state, p.service, p.status,
  0::numeric, 0::numeric, 0::numeric, 0::numeric, p.contracted_value, 0::numeric, 0::numeric, 0::numeric
from public.report_project_dimensions p
union all
select
  'contract', ct.id, (ct.contracted_at::timestamp at time zone 'America/Sao_Paulo'),
  cd.niche, cd.city, cd.state, ct.service, ct.status,
  0::numeric, 0::numeric, 0::numeric, ct.total_value, 0::numeric, 0::numeric, 0::numeric, 0::numeric
from public.contracts ct
join public.report_client_dimensions cd on cd.client_id = ct.client_id
where ct.status = 'active'
union all
select
  'payment', f.entry_id, f.occurred_at, f.niche, f.city, f.state, f.service, f.kind,
  0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
  case when f.kind = 'receipt' then f.amount else 0::numeric end,
  case when f.kind = 'refund' then f.amount else 0::numeric end,
  0::numeric
from public.report_financial_entries f
where f.kind in ('receipt', 'refund')
union all
select
  'expense', f.entry_id, f.occurred_at, f.niche, f.city, f.state, f.service, f.status,
  0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, f.amount
from public.report_financial_entries f
where f.kind = 'expense' and f.status = 'paid';

revoke all on public.report_client_dimensions from public, anon, authenticated;
revoke all on public.report_project_dimensions from public, anon, authenticated;
revoke all on public.report_financial_entries from public, anon, authenticated;
revoke all on public.report_consolidated_facts from public, anon, authenticated;
grant select on public.report_client_dimensions to authenticated;
grant select on public.report_project_dimensions to authenticated;
grant select on public.report_financial_entries to authenticated;
grant select on public.report_consolidated_facts to authenticated;

revoke all on function public.report_require_session() from public, anon, authenticated;
revoke all on function public.report_validate_period(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.report_normalize_niche(text) from public, anon, authenticated;
revoke all on function public.report_bucket(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.report_buckets(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.report_rate(bigint, bigint) from public, anon, authenticated;
revoke all on function public.report_export_scope(text, timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.report_require_session() to authenticated;
grant execute on function public.report_validate_period(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_normalize_niche(text) to authenticated;
grant execute on function public.report_bucket(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_buckets(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_rate(bigint, bigint) to authenticated;
grant execute on function public.report_export_scope(text, timestamptz, timestamptz, text, text, text, text)
  to authenticated;

commit;
```

- [ ] **Step 3: Aplicar localmente, executar o teste GREEN e commitar**

Comandos:

```bash
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: views vazias sob o owner sintético, buckets corretos, `security_invoker=true`, funções invoker, privilégios e índices confirmados.

```bash
git add supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql
git commit -m "feat: adicionar base segura dos relatórios"
```

---

### Task 4: Implementar Prospecção e Oportunidades no servidor

**Arquivos:**
- Modificar: `supabase/migrations/0010_etapa3_reports.sql`
- Modificar: `supabase/tests/etapa3_reports.sql`

**Interfaces:**
- Produz `get_report_prospecting(timestamptz,timestamptz,text,text,text,text) returns jsonb`.
- Produz `get_report_opportunities(timestamptz,timestamptz,text,text,text,text) returns jsonb`.
- Produz `report_rate_json(bigint,bigint) returns jsonb`.

- [ ] **Step 1: Estender o teste SQL com fixtures e asserções RED**

Inserir o bloco abaixo imediatamente antes do `rollback;` final de `supabase/tests/etapa3_reports.sql`:

```sql
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into public.leads (owner_id, name, niche, city, state, status, offered_service,
  estimated_value, negotiated_value, contracted_value, needs, priority,
  has_instagram, has_website, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'Lead Um', 'barbearia', 'São Paulo', 'SP', 'novo', 'Site',
    1000, 1200, 0, array['site'], 'alta', 'yes', 'no', '2026-11-21T12:00:00Z', '2026-11-21T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'Lead Dois', 'pizzaria', 'Campinas', 'SP', 'contato_realizado', 'Cardápio',
    2000, 2200, 0, array['cardapio'], 'media', 'yes', 'yes', '2026-11-22T12:00:00Z', '2026-11-22T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'Lead Três', 'barbearia', 'São Paulo', 'SP', 'interessado', 'Site',
    3000, 3200, 0, array['site', 'landing'], 'muito_alta', 'yes', 'unverified', '2026-11-23T12:00:00Z', '2026-11-23T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'Lead Quatro', 'cafeteria', 'São Paulo', 'SP', 'negociando', 'Landing',
    4000, 4200, 0, array['landing'], 'alta', 'no', 'no', '2026-11-24T12:00:00Z', '2026-11-24T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'Lead Cinco', 'pizzaria', 'Campinas', 'SP', 'aceitou', 'Site',
    5000, 5200, 5000, array['site'], 'media', 'yes', 'yes', '2026-11-25T12:00:00Z', '2026-11-25T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'Lead Seis', null, null, null, 'novo', null,
    0, 0, 0, array[]::text[], 'baixa', 'unverified', 'unverified', '2026-11-26T12:00:00Z', '2026-11-26T12:00:00Z'),
  ('00000000-0000-4000-8000-000000000001', 'Lead Sete', 'barbearia', 'São Paulo', 'SP', 'novo', 'Site',
    7000, 0, 0, array['site'], 'media', 'yes', 'no', '2026-11-26T13:00:00Z', '2026-11-26T13:00:00Z');

insert into public.lead_activities (owner_id, lead_id, type, description, created_at)
select '00000000-0000-4000-8000-000000000001', id, activity.type, activity.description, activity.created_at
from (values
  ('Lead Um', 'primeiro_contato'::text, 'Primeiro contato', '2026-11-21T15:00:00Z'::timestamptz),
  ('Lead Um', 'mensagem', 'Mensagem', '2026-11-22T15:00:00Z'),
  ('Lead Um', 'resposta', 'Resposta um', '2026-11-22T16:00:00Z'),
  ('Lead Dois', 'ligacao', 'Ligação', '2026-11-23T15:00:00Z'),
  ('Lead Dois', 'resposta', 'Resposta dois', '2026-11-24T15:00:00Z'),
  ('Lead Três', 'mensagem', 'Mensagem três', '2026-11-24T16:00:00Z'),
  ('Lead Quatro', 'resposta', 'Resposta sem contato identificado', '2026-11-25T15:00:00Z')
) as activity(name, type, description, created_at)
join public.leads l on l.name = activity.name and l.owner_id = '00000000-0000-4000-8000-000000000001';

select public.convert_lead_to_client(
  (select id from public.leads where name = 'Lead Cinco' and owner_id = '00000000-0000-4000-8000-000000000001'),
  'Site', 5000, date '2026-11-25', 'pix', null, null, null, null, null
);

do $$
declare
  result jsonb;
  opportunity_result jsonb;
  outside_cohort_id uuid;
begin
  result := public.get_report_prospecting(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, null
  );
  if (result -> 'cohort' ->> 'total')::int <> 7
    or (result -> 'events' ->> 'contacts')::int <> 4
    or (result -> 'events' ->> 'contactedLeads')::int <> 3
    or (result -> 'events' ->> 'responses')::int <> 3
    or (result -> 'events' ->> 'respondedLeads')::int <> 3
    or (result -> 'events' ->> 'conversions')::int <> 1
    or (result -> 'rates' -> 'response' ->> 'value')::numeric <> 1
    or abs((result -> 'rates' -> 'conversion' ->> 'value')::numeric - (1.0 / 7)) > 0.000001
    or pg_catalog.jsonb_array_length(result -> 'ranking') <> 4
    or exists (select 1 from jsonb_array_elements(result -> 'ranking') item where item ->> 'rank' is null)
    or (select sum((item ->> 'count')::int) from jsonb_array_elements(result -> 'ranking') item) <> 7 then
    raise exception 'Prospecção ou ranking incorretos: %', result;
  end if;

  result := public.get_report_prospecting(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', 'barbearia', null, null, null
  );
  if (result -> 'cohort' ->> 'total')::int <> 3
    or (result -> 'events' ->> 'contacts')::int <> 3
    or pg_catalog.jsonb_array_length(result -> 'ranking') <> 1
    or (result -> 'ranking' -> 0 ->> 'count')::int <> 3
    or (result -> 'ranking' -> 0 ->> 'rank')::int <> 1 then
    raise exception 'Filtro de nicho ou ranking de grupo único não foi aplicado corretamente: %', result;
  end if;

  opportunity_result := public.get_report_opportunities(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, null
  );
  if (opportunity_result ->> 'qualified')::int <> 5
    or (opportunity_result ->> 'notProspected')::int <> 1
    or (opportunity_result ->> 'instagramWithoutSiteConfirmed')::int <> 2
    or (opportunity_result ->> 'instagramWithoutSiteUnverified')::int <> 1
    or (opportunity_result ->> 'estimatedCents')::int <> 1700000
    or pg_catalog.jsonb_array_length(opportunity_result -> 'ranking') <> 3
    or exists (select 1 from jsonb_array_elements(opportunity_result -> 'ranking') item where item ->> 'rank' is null)
    or (select sum((item ->> 'count')::int) from jsonb_array_elements(opportunity_result -> 'ranking') item) <> 5 then
    raise exception 'Oportunidades ou ranking incorretos: %', opportunity_result;
  end if;

  savepoint prospecting_cohort_conversion_probe;
  insert into public.leads (owner_id, name, niche, city, status, offered_service,
    estimated_value, negotiated_value, contracted_value, needs, priority,
    has_instagram, has_website, created_at, updated_at)
  values ('00000000-0000-4000-8000-000000000001', 'Lead anterior à coorte', 'barbearia', 'São Paulo',
    'aceitou', 'Site', 1000, 1000, 1000, array['site'], 'media', 'yes', 'no',
    '2026-11-19T12:00:00Z', '2026-11-19T12:00:00Z')
  returning id into outside_cohort_id;
  perform public.convert_lead_to_client(
    outside_cohort_id, 'Site', 1000, date '2026-11-26', 'pix', null, null, null, null, null
  );
  result := public.get_report_prospecting(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, null
  );
  if (result -> 'cohort' ->> 'total')::int <> 7
    or (result -> 'events' ->> 'conversions')::int <> 2
    or (result -> 'rates' -> 'conversion' ->> 'numerator')::int <> 1
    or (result -> 'rates' -> 'conversion' ->> 'denominator')::int <> 7
    or abs((result -> 'rates' -> 'conversion' ->> 'value')::numeric - (1.0 / 7)) > 0.000001 then
    raise exception 'Conversão de lead fora da coorte contaminou a taxa: %', result;
  end if;
  rollback to savepoint prospecting_cohort_conversion_probe;

  select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
  result := public.get_report_prospecting(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, null
  );
  if (result -> 'cohort' ->> 'total')::int <> 0 then
    raise exception 'Prospecção vazou dados entre owners.';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_report_prospecting', 'get_report_opportunities')
      and p.prosecdef
  ) then
    raise exception 'RPC de relatório marcada security definer.';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.get_report_prospecting(timestamptz,timestamptz,text,text,text,text)', 'EXECUTE') then
    raise exception 'RPC de prospecção executável por anon.';
  end if;
end;
$$;
```

Comando: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql`
Falha esperada: `get_report_prospecting` não existe.

- [ ] **Step 2: Inserir o helper de taxa e as duas RPCs antes de `commit;`**

Adicionar ao final de `0010_etapa3_reports.sql`, imediatamente antes de `commit;`:

```sql
create or replace function public.report_rate_json(p_numerator bigint, p_denominator bigint)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'numerator', coalesce(p_numerator, 0),
    'denominator', coalesce(p_denominator, 0),
    'value', public.report_rate(p_numerator, p_denominator),
    'sufficient', coalesce(p_denominator, 0) >= 5
  );
$$;

create or replace function public.get_report_prospecting(
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
begin
  perform public.report_validate_period(p_start, p_end);
  if v_status is not null and v_status <> all (array[
    'novo', 'contato_realizado', 'aguardando_resposta', 'pediu_informacoes',
    'interessado', 'negociando', 'aceitou', 'ignorou', 'nao_interessado', 'follow_up', 'perdido'
  ]) then
    raise exception 'Status de lead inválido.' using errcode = '22023';
  end if;

  return (
    with params as (
      select v_niche as niche, v_city as city, v_status as status, v_service as service
    ),
    cohort as (
      select l.*
      from public.leads l cross join params f
      where l.created_at >= p_start and l.created_at < p_end
        and (f.niche is null or l.niche = f.niche)
        and (f.city is null or l.city = f.city)
        and (f.status is null or l.status = f.status)
        and (f.service is null or l.offered_service = f.service)
    ),
    contacts as (
      select a.id, a.lead_id, a.created_at
      from public.lead_activities a
      join public.leads l on l.id = a.lead_id and l.owner_id = a.owner_id
      cross join params f
      where a.created_at >= p_start and a.created_at < p_end
        and a.type in ('primeiro_contato', 'mensagem', 'ligacao')
        and (f.niche is null or l.niche = f.niche)
        and (f.city is null or l.city = f.city)
        and (f.status is null or l.status = f.status)
        and (f.service is null or l.offered_service = f.service)
    ),
    responses as (
      select a.id, a.lead_id, a.created_at
      from public.lead_activities a
      join public.leads l on l.id = a.lead_id and l.owner_id = a.owner_id
      cross join params f
      where a.created_at >= p_start and a.created_at < p_end
        and a.type = 'resposta'
        and (f.niche is null or l.niche = f.niche)
        and (f.city is null or l.city = f.city)
        and (f.status is null or l.status = f.status)
        and (f.service is null or l.offered_service = f.service)
    ),
    conversions as (
      select lc.id, lc.lead_id, lc.converted_at
      from public.lead_client_links lc
      join public.leads l on l.id = lc.lead_id and l.owner_id = lc.owner_id
      cross join params f
      where lc.converted_at >= p_start and lc.converted_at < p_end
        and (f.niche is null or l.niche = f.niche)
        and (f.city is null or l.city = f.city)
        and (f.status is null or l.status = f.status)
        and (f.service is null or l.offered_service = f.service)
    ),
    cohort_conversions as (
      select l.id as lead_id, min(lc.converted_at) as converted_at
      from cohort l
      join public.lead_client_links lc on lc.lead_id = l.id and lc.owner_id = l.owner_id
      where lc.converted_at >= p_start and lc.converted_at < p_end
      group by l.id
    ),
    summary as (
      select
        (select count(*) from cohort) as cohort_total,
        (select count(*) from contacts) as contacts,
        (select count(distinct lead_id) from contacts) as contacted_leads,
        (select count(*) from responses) as responses,
        (select count(distinct lead_id) from responses) as responded_leads,
        (select count(*) from conversions) as conversions,
        (select count(*) from cohort_conversions) as cohort_conversions
    ),
    series as (
      select b.bucket_start, b.label,
        (select count(*) from cohort l
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), l.created_at at time zone 'America/Sao_Paulo') = b.bucket_start) as leads,
        (select count(*) from cohort_conversions c
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), c.converted_at at time zone 'America/Sao_Paulo') = b.bucket_start) as conversions,
        (select count(distinct lead_id) from responses r
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), r.created_at at time zone 'America/Sao_Paulo') = b.bucket_start) as responded_leads,
        (select count(distinct lead_id) from contacts c
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), c.created_at at time zone 'America/Sao_Paulo') = b.bucket_start) as contacted_leads
      from public.report_buckets(p_start, p_end) b
    ),
    grouped as (
      select coalesce(l.niche, 'Não informado') as key, count(*)::bigint as count,
        count(distinct c.id)::bigint as conversions
      from cohort l left join cohort_conversions c on c.lead_id = l.id
      group by coalesce(l.niche, 'Não informado')
    ),
    ranked as (
      select g.*, pg_catalog.row_number() over (order by g.count desc, g.key) as rank
      from grouped g
    )
    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(), 'start_date', (p_start at time zone 'America/Sao_Paulo')::date,
        'end_date', ((p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
        'start_at', p_start, 'end_at', p_end,
        'filters', jsonb_build_object('period', null, 'niche', v_niche, 'city', v_city, 'status', v_status, 'service', v_service),
        'warnings', pg_catalog.array_to_json(pg_catalog.array_remove(array[
          case when s.cohort_total = 0 then 'Nenhum lead na coorte e nos filtros selecionados.' end,
          case when s.contacted_leads > 0 and s.contacted_leads < 5 then 'Taxa de resposta sem amostra mínima de 5 leads contatados.' end,
          case when s.cohort_total > 0 and s.cohort_total < 5 then 'Taxa de conversão sem amostra mínima de 5 leads na coorte.' end,
          case when s.responded_leads > s.contacted_leads then 'Há respostas sem contato identificado no período; a taxa pode superar 100%.' end
        ], null))
      ),
      'cohort', jsonb_build_object('total', s.cohort_total),
      'events', jsonb_build_object(
        'contacts', s.contacts, 'contactedLeads', s.contacted_leads,
        'responses', s.responses, 'respondedLeads', s.responded_leads, 'conversions', s.conversions
      ),
      'rates', jsonb_build_object(
        'response', public.report_rate_json(s.responded_leads, s.contacted_leads),
        'conversion', public.report_rate_json(s.cohort_conversions, s.cohort_total)
      ),
      'series', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', x.bucket_start, 'label', x.label, 'count', x.leads,
          'numerator', x.conversions, 'denominator', x.leads,
          'rate', public.report_rate_json(x.conversions, x.leads)
        ) order by x.bucket_start)
        from series x
      ), '[]'::jsonb),
      'byStatus', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select l.status as key, count(*)::bigint as count from cohort l group by l.status) x
      ), '[]'::jsonb),
      'byNiche', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(l.niche, 'Não informado') as key, count(*)::bigint as count from cohort l group by coalesce(l.niche, 'Não informado')) x
      ), '[]'::jsonb),
      'byCity', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(l.city, 'Não informado') as key, count(*)::bigint as count from cohort l group by coalesce(l.city, 'Não informado')) x
      ), '[]'::jsonb),
      'byService', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(l.offered_service, 'Não informado') as key, count(*)::bigint as count from cohort l group by coalesce(l.offered_service, 'Não informado')) x
      ), '[]'::jsonb),
      'ranking', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', x.key, 'label', x.key, 'count', x.count,
          'rate', public.report_rate_json(x.conversions, x.count), 'rank', x.rank
        ) order by x.count desc, x.key)
        from ranked x
      ), '[]'::jsonb)
    from summary s
  );
end;
$$;

create or replace function public.get_report_opportunities(
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
begin
  perform public.report_validate_period(p_start, p_end);
  if v_status is not null and v_status <> all (array[
    'novo', 'contato_realizado', 'aguardando_resposta', 'pediu_informacoes',
    'interessado', 'negociando', 'aceitou', 'ignorou', 'nao_interessado', 'follow_up', 'perdido'
  ]) then
    raise exception 'Status de lead inválido.' using errcode = '22023';
  end if;

  return (
    with params as (
      select v_niche as niche, v_city as city, v_status as status, v_service as service
    ),
    cohort as (
      select l.*
      from public.leads l cross join params f
      where l.created_at >= p_start and l.created_at < p_end
        and (f.niche is null or l.niche = f.niche)
        and (f.city is null or l.city = f.city)
        and (f.status is null or l.status = f.status)
        and (f.service is null or l.offered_service = f.service)
    ),
    qualified as (
      select l.* from cohort l
      where pg_catalog.cardinality(l.needs) > 0
        and l.status not in ('aceitou', 'perdido', 'nao_interessado')
    ),
    conversions as (
      select lc.id, lc.lead_id, lc.converted_at
      from public.lead_client_links lc
      join cohort l on l.id = lc.lead_id
      where lc.converted_at >= p_start and lc.converted_at < p_end
    ),
    receipts as (
      select
        coalesce(sum(case when f.kind = 'receipt' then public.financial_to_cents(f.amount) else 0 end), 0)::bigint as receipts,
        coalesce(sum(case when f.kind = 'refund' then public.financial_to_cents(f.amount) else 0 end), 0)::bigint as refunds
      from public.report_financial_entries f
      join public.contracts ct on ct.id = f.contract_id
      join public.lead_client_links lc on lc.id = ct.source_link_id
      join cohort l on l.id = lc.lead_id
      where f.occurred_at >= p_start and f.occurred_at < p_end
    ),
    summary as (
      select
        (select count(*) from cohort) as total_leads,
        (select count(*) from qualified) as qualified,
        (select count(*) from qualified q where q.status = 'novo' and not exists (
          select 1 from public.lead_activities a
          where a.lead_id = q.id and a.type in ('primeiro_contato', 'mensagem', 'ligacao')
        )) as not_prospected,
        (select count(*) from qualified where has_instagram = 'yes' and has_website = 'no') as confirmed,
        (select count(*) from qualified where has_instagram = 'yes' and has_website = 'unverified') as unverified,
        (select coalesce(sum(public.financial_to_cents(estimated_value)), 0)::bigint from qualified) as estimated,
        (select coalesce(sum(public.financial_to_cents(negotiated_value)), 0)::bigint from qualified) as negotiated,
        (select coalesce(sum(public.financial_to_cents(contracted_value)), 0)::bigint from qualified) as contracted,
        (select receipts - refunds from receipts) as received,
        (select count(*) from conversions) as conversions
    ),
    service_groups as (
      select coalesce(q.offered_service, 'Não informado') as key,
        count(*)::bigint as count,
        sum(public.financial_to_cents(q.estimated_value))::bigint as estimated,
        sum(public.financial_to_cents(q.negotiated_value))::bigint as negotiated,
        count(distinct c.id)::bigint as conversions
      from qualified q left join conversions c on c.lead_id = q.id
      group by coalesce(q.offered_service, 'Não informado')
    ),
    ranked as (
      select g.*, pg_catalog.row_number() over (order by g.count desc, g.key) as rank
      from service_groups g
    )
    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(), 'start_date', (p_start at time zone 'America/Sao_Paulo')::date,
        'end_date', ((p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
        'start_at', p_start, 'end_at', p_end,
        'filters', jsonb_build_object('period', null, 'niche', v_niche, 'city', v_city, 'status', v_status, 'service', v_service),
        'warnings', pg_catalog.array_to_json(pg_catalog.array_remove(array[
          case when s.total_leads = 0 then 'Nenhum lead na coorte e nos filtros selecionados.' end,
          case when s.total_leads > 0 and s.total_leads < 5 then 'Taxa de conversão sem amostra mínima de 5 leads.' end
        ], null))
      ),
      'totalLeads', s.total_leads, 'qualified', s.qualified, 'notProspected', s.not_prospected,
      'instagramWithoutSiteConfirmed', s.confirmed, 'instagramWithoutSiteUnverified', s.unverified,
      'estimatedCents', s.estimated, 'negotiatedCents', s.negotiated,
      'contractedSnapshotCents', s.contracted, 'receivedLedgerCents', s.received,
      'conversionRate', public.report_rate_json(s.conversions, s.total_leads),
      'byNiche', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(niche, 'Não informado') as key, count(*)::bigint as count from qualified group by coalesce(niche, 'Não informado')) x
      ), '[]'::jsonb),
      'byNeed', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select need as key, count(*)::bigint as count from qualified cross join lateral unnest(needs) as need group by need) x
      ), '[]'::jsonb),
      'byPriority', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select priority as key, count(*)::bigint as count from qualified group by priority) x
      ), '[]'::jsonb),
      'byCity', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(city, 'Não informado') as key, count(*)::bigint as count from qualified group by coalesce(city, 'Não informado')) x
      ), '[]'::jsonb),
      'byState', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(state, 'Não informado') as key, count(*)::bigint as count from qualified group by coalesce(state, 'Não informado')) x
      ), '[]'::jsonb),
      'byService', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count, 'amountCents', x.estimated) order by x.count desc, x.key)
        from service_groups x
      ), '[]'::jsonb),
      'ranking', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', x.key, 'label', x.key, 'count', x.count, 'amountCents', x.estimated,
          'rate', public.report_rate_json(x.conversions, x.count), 'rank', x.rank
        ) order by x.count desc, x.key)
        from ranked x
      ), '[]'::jsonb)
    from summary s
  );
end;
$$;

revoke all on function public.report_rate_json(bigint, bigint) from public, anon, authenticated;
revoke all on function public.get_report_prospecting(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.get_report_opportunities(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.report_rate_json(bigint, bigint) to authenticated;
grant execute on function public.get_report_prospecting(timestamptz, timestamptz, text, text, text, text)
  to authenticated;
grant execute on function public.get_report_opportunities(timestamptz, timestamptz, text, text, text, text)
  to authenticated;
```

- [ ] **Step 3: Executar o teste GREEN e commitar**

Comandos:

```bash
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: coorte, eventos, resposta, conversão, filtros, elegibilidade e isolamento entre owners passando; nenhuma RPC é security definer.

```bash
git add supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql
git commit -m "feat: agregar prospecção e oportunidades no servidor"
```

---

### Task 5: Implementar Clientes e Projetos no servidor

**Arquivos:**
- Modificar: `supabase/migrations/0010_etapa3_reports.sql`
- Modificar: `supabase/tests/etapa3_reports.sql`

**Interfaces:**
- Produz `get_report_clients(timestamptz,timestamptz,text,text,text,text) returns jsonb`.
- Produz `get_report_projects(timestamptz,timestamptz,text,text,text,text) returns jsonb`.
- Histórico de cliente combina atividades próprias, atividades do lead vinculado e contratos, sem duplicar a conversão/contrato inicial.
- Atenção de projeto combina atraso, revisão/aprovação pendente e tarefas vencidas.

- [ ] **Step 1: Estender o teste SQL com cliente manual, projetos e RED**

Inserir imediatamente antes do `rollback;` final:

```sql
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  manual jsonb;
  client_id uuid;
  contract_id uuid;
  first_project jsonb;
  second_project jsonb;
  first_id uuid;
  second_id uuid;
  result jsonb;
  project_result jsonb;
begin
  manual := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente manual de relatório',
    'city', 'Santos', 'state', 'SP', 'niche', 'manicure', 'status', 'active',
    'service', 'Consultoria', 'total_value', '750.50', 'contracted_at', date '2026-10-01',
    'due_date', date '2026-12-31', 'payment_method', 'pix'
  ));
  client_id := ((manual ->> 'client')::jsonb ->> 'id')::uuid;
  contract_id := ((manual ->> 'contract')::jsonb ->> 'id')::uuid;

  first_project := public.create_project(jsonb_build_object(
    'client_id', client_id, 'contract_id', contract_id, 'name', 'Projeto concluído',
    'service', 'Consultoria', 'contracted_value', '500.00',
    'start_date', date '2026-11-01', 'due_date', date '2026-11-10', 'priority', 'high'
  ));
  first_id := (first_project ->> 'id')::uuid;
  perform public.set_project_status(first_id, 'completed');

  second_project := public.create_project(jsonb_build_object(
    'client_id', client_id, 'contract_id', contract_id, 'name', 'Projeto em revisão',
    'service', 'Consultoria', 'contracted_value', '250.50',
    'start_date', date '2026-11-01', 'due_date', date '2026-11-20', 'priority', 'medium'
  ));
  second_id := (second_project ->> 'id')::uuid;
  perform public.set_project_status(second_id, 'in_review');

  insert into public.project_tasks (owner_id, project_id, title, status, due_date)
  values ('00000000-0000-4000-8000-000000000001', second_id, 'Tarefa vencida', 'pending', date '2026-11-20');
  insert into public.project_revisions (owner_id, project_id, description, status)
  values ('00000000-0000-4000-8000-000000000001', second_id, 'Revisão pendente', 'requested');

  result := public.get_report_clients(
    '2026-10-01T03:00:00Z', '2027-01-01T03:00:00Z', null, null, null, null
  );
  if (result ->> 'total')::int <> 2
    or (result ->> 'active')::int <> 2
    or (result ->> 'inProject')::int <> 1
    or (result ->> 'pendingPayment')::int <> 2
    or (result ->> 'pendingCents')::int <> 575050
    or (result ->> 'conversionsInPeriod')::int <> 1 then
    raise exception 'Clientes incorretos: %', result;
  end if;
  if exists (
    select 1 from jsonb_array_elements(result -> 'history') h
    where h ->> 'source' = 'contract'
      and h ->> 'description' like 'Contrato de % registrado.'
  ) then
    raise exception 'Contrato inicial duplicado no histórico.';
  end if;

  update public.clients c set niche = 'manicure'
  from public.lead_client_links lc
  join public.leads l on l.id = lc.lead_id
  where lc.client_id = c.id and l.name = 'Lead Cinco'
    and c.owner_id = '00000000-0000-4000-8000-000000000001';

  result := public.get_report_clients(
    '2026-10-01T03:00:00Z', '2027-01-01T03:00:00Z', 'pizzaria', null, null, null
  );
  if (result ->> 'total')::int <> 1
    or exists (
      select 1 from jsonb_array_elements(result -> 'byNiche') g
      where g ->> 'key' <> 'pizzaria'
    ) then
    raise exception 'Nicho do cliente convertido não veio do lead vinculado: %', result;
  end if;

  result := public.get_report_clients(
    '2026-10-01T03:00:00Z', '2027-01-01T03:00:00Z', 'barbearia', null, null, null
  );
  if (result ->> 'total')::int <> 0 then
    raise exception 'Nicho manual substituiu o vínculo do lead convertido.';
  end if;

  project_result := public.get_report_projects(
    '2026-10-01T03:00:00Z', '2027-01-01T03:00:00Z', null, null, null, null
  );
  if (project_result ->> 'total')::int <> 2
    or (project_result ->> 'delayed')::int <> 1
    or (project_result -> 'completionRate' ->> 'numerator')::int <> 1
    or (project_result -> 'completionRate' ->> 'denominator')::int <> 2
    or (project_result -> 'completionRate' ->> 'value')::numeric <> 0.5
    or (project_result -> 'attention' ->> 'total')::int <> 1
    or (project_result -> 'attention' ->> 'pendingReview')::int <> 1
    or (project_result -> 'attention' ->> 'overdueTasks')::int <> 1 then
    raise exception 'Projetos incorretos: %', project_result;
  end if;
  if (project_result ->> 'averageDurationDays') is null then
    raise exception 'Prazo médio deveria existir para o projeto concluído.';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_report_clients', 'get_report_projects') and p.prosecdef
  ) then
    raise exception 'RPC de cliente/projeto marcada security definer.';
  end if;
end;
$$;
```

Comando: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql`
Falha esperada: `get_report_clients` não existe.

- [ ] **Step 2: Inserir as RPCs antes de `commit;`**

```sql
create or replace function public.get_report_clients(
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
begin
  perform public.report_validate_period(p_start, p_end);
  if v_status is not null and v_status <> all (array[
    'active', 'in_project', 'awaiting_payment', 'awaiting_approval', 'project_completed', 'inactive'
  ]) then
    raise exception 'Status de cliente inválido.' using errcode = '22023';
  end if;

  return (
    with params as (
      select v_niche as niche, v_city as city, v_status as status, v_service as service
    ),
    base as (
      select c.* from public.report_client_dimensions c cross join params f
      where (f.niche is null or c.niche = f.niche)
        and (f.city is null or c.city = f.city)
        and (f.status is null or c.status = f.status)
        and (f.service is null or c.service = f.service)
    ),
    balances as (
      select ct.client_id,
        sum(greatest(ct.total_value - coalesce(net.net_received, 0), 0)) as pending
      from public.contracts ct
      join base c on c.client_id = ct.client_id
      left join lateral (
        select sum(case when p.type = 'receipt' then p.amount else -p.amount end) as net_received
        from public.financial_payments p where p.contract_id = ct.id
      ) net on true
      where ct.status = 'active'
      group by ct.client_id
    ),
    pending_clients as (
      select client_id, pending from balances where pending > 0
    ),
    active_projects as (
      select distinct p.client_id
      from public.projects p join base c on c.client_id = p.client_id
      where p.status not in ('cancelled', 'completed', 'delivered')
    ),
    new_clients as (
      select c.* from base c where c.created_at >= p_start and c.created_at < p_end
    ),
    conversions as (
      select lc.id, lc.client_id, lc.converted_at
      from public.lead_client_links lc join base c on c.client_id = lc.client_id
      where lc.converted_at >= p_start and lc.converted_at < p_end
    ),
    client_events as (
      select a.id::text as id, a.client_id, c.client_name, a.type, a.description, a.created_at, 'client'::text as source
      from public.client_activities a join base c on c.client_id = a.client_id
      where a.created_at >= p_start and a.created_at < p_end
    ),
    lead_events as (
      select a.id::text, lc.client_id, c.client_name, a.type, a.description, a.created_at, 'lead'::text
      from public.lead_activities a
      join public.lead_client_links lc on lc.lead_id = a.lead_id
      join base c on c.client_id = lc.client_id
      where a.created_at >= p_start and a.created_at < p_end
        and a.type <> 'conversao'
        and not exists (
          select 1 from public.client_activities ca
          where ca.client_id = c.client_id and ca.created_at = a.created_at and ca.description = a.description
        )
    ),
    contract_events as (
      select ct.id::text, ct.client_id, c.client_name, 'contract'::text as type,
        'Contrato de ' || ct.service || ' registrado.' as description,
        (ct.contracted_at::timestamp at time zone 'America/Sao_Paulo') as created_at,
        'contract'::text as source
      from public.contracts ct join base c on c.client_id = ct.client_id
      where (ct.contracted_at::timestamp at time zone 'America/Sao_Paulo') >= p_start
        and (ct.contracted_at::timestamp at time zone 'America/Sao_Paulo') < p_end
        and not exists (
          select 1 from public.client_activities ca where ca.client_id = ct.client_id and ca.contract_id = ct.id
        )
    ),
    history_union as (
      select * from client_events union all select * from lead_events union all select * from contract_events
    ),
    history as (
      select * from history_union order by created_at desc, id desc limit 100
    ),
    history_count as (select count(*)::bigint as total from history_union),
    summary as (
      select
        (select count(*) from base) as total,
        (select count(*) from base where status = 'active') as active,
        (select count(*) from base where status = 'inactive') as inactive,
        (select count(*) from base c where exists (select 1 from active_projects p where p.client_id = c.client_id)) as in_project,
        (select count(*) from pending_clients) as pending_payment,
        (select coalesce(sum(pending), 0) from pending_clients) as pending,
        (select count(*) from new_clients) as new_clients,
        (select count(*) from conversions) as conversions
    ),
    series as (
      select b.bucket_start, b.label,
        (select count(*) from new_clients c
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), c.created_at at time zone 'America/Sao_Paulo') = b.bucket_start) as new_clients,
        (select count(*) from conversions c
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), c.converted_at at time zone 'America/Sao_Paulo') = b.bucket_start) as conversions
      from public.report_buckets(p_start, p_end) b
    )
    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(), 'start_date', (p_start at time zone 'America/Sao_Paulo')::date,
        'end_date', ((p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
        'start_at', p_start, 'end_at', p_end,
        'filters', jsonb_build_object('period', null, 'niche', v_niche, 'city', v_city, 'status', v_status, 'service', v_service),
        'warnings', pg_catalog.array_to_json(pg_catalog.array_remove(array[
          case when s.total = 0 then 'Nenhum cliente nos filtros selecionados.' end,
          case when h.total > 100 then 'O histórico está limitado aos 100 eventos mais recentes.' end
        ], null))
      ),
      'total', s.total, 'active', s.active, 'inactive', s.inactive, 'inProject', s.in_project,
      'pendingPayment', s.pending_payment, 'pendingCents', public.financial_to_cents(s.pending),
      'newInPeriod', s.new_clients, 'conversionsInPeriod', s.conversions,
      'series', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', x.bucket_start, 'label', x.label, 'count', x.new_clients,
          'numerator', x.conversions, 'denominator', x.new_clients,
          'rate', public.report_rate_json(x.conversions, x.new_clients)
        ) order by x.bucket_start)
        from series x
      ), '[]'::jsonb),
      'byStatus', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select status as key, count(*)::bigint as count from base group by status) x
      ), '[]'::jsonb),
      'byNiche', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(niche, 'Não informado') as key, count(*)::bigint as count from base group by coalesce(niche, 'Não informado')) x
      ), '[]'::jsonb),
      'byCity', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(city, 'Não informado') as key, count(*)::bigint as count from base group by coalesce(city, 'Não informado')) x
      ), '[]'::jsonb),
      'byService', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select coalesce(service, 'Não informado') as key, count(*)::bigint as count from base group by coalesce(service, 'Não informado')) x
      ), '[]'::jsonb),
      'history', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc) from history x), '[]'::jsonb),
      'historyTruncated', (select total > 100 from history_count)
    from summary s cross join history_count h
  );
end;
$$;

create or replace function public.get_report_projects(
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
begin
  perform public.report_validate_period(p_start, p_end);
  if v_status is not null and v_status <> all (array[
    'not_started', 'planning', 'in_development', 'awaiting_client_info', 'in_review',
    'awaiting_approval', 'changes_requested', 'completed', 'delivered', 'cancelled'
  ]) then
    raise exception 'Status de projeto inválido.' using errcode = '22023';
  end if;

  return (
    with params as (
      select v_niche as niche, v_city as city, v_status as status, v_service as service,
        (now() at time zone 'America/Sao_Paulo')::date as today
    ),
    base as (
      select p.* from public.report_project_dimensions p cross join params f
      where (f.niche is null or p.niche = f.niche)
        and (f.city is null or p.city = f.city)
        and (f.status is null or p.status = f.status)
        and (f.service is null or p.service = f.service)
    ),
    cohort as (
      select p.* from base p where p.created_at >= p_start and p.created_at < p_end
    ),
    completed as (
      select p.* from base p
      where p.status in ('completed', 'delivered') and p.completed_at >= p_start and p.completed_at < p_end
    ),
    flags as (
      select p.*,
        (p.due_date < f.today and p.status not in ('completed', 'delivered', 'cancelled')) as delayed,
        (p.status = 'in_review' or exists (
          select 1 from public.project_revisions r
          where r.project_id = p.project_id and r.status in ('requested', 'in_progress')
        )) as pending_review,
        (p.status = 'awaiting_approval') as pending_approval,
        exists (
          select 1 from public.project_tasks t
          where t.project_id = p.project_id and t.status in ('pending', 'in_progress') and t.due_date < f.today
        ) as overdue_tasks
      from base p cross join params f
    ),
    attention as (
      select * from flags where delayed or pending_review or pending_approval or overdue_tasks
    ),
    attention_count as (select count(*)::bigint as total from attention),
    summary as (
      select
        (select count(*) from base) as total,
        (select count(*) from flags where delayed) as delayed,
        (select count(*) from cohort where status not in ('cancelled')) as cohort_denominator,
        (select count(*) from cohort where status in ('completed', 'delivered')) as cohort_completed,
        (select pg_catalog.round(pg_catalog.avg(
          pg_catalog.extract(epoch from (p.completed_at at time zone 'America/Sao_Paulo') - p.start_date::timestamp) / 86400
        ), 2) from completed p where p.start_date is not null and p.completed_at is not null) as average_days,
        (select total from attention_count) as attention_total,
        (select count(*) from flags where pending_review) as pending_review,
        (select count(*) from flags where pending_approval) as pending_approval,
        (select count(*) from flags where overdue_tasks) as overdue_tasks
    ),
    productivity as (
      select b.bucket_start, b.label,
        (select count(*) from completed p
          where pg_catalog.date_trunc(public.report_bucket(p_start, p_end), p.completed_at at time zone 'America/Sao_Paulo') = b.bucket_start) as completed
      from public.report_buckets(p_start, p_end) b
    )
    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(), 'start_date', (p_start at time zone 'America/Sao_Paulo')::date,
        'end_date', ((p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
        'start_at', p_start, 'end_at', p_end,
        'filters', jsonb_build_object('period', null, 'niche', v_niche, 'city', v_city, 'status', v_status, 'service', v_service),
        'warnings', pg_catalog.array_to_json(pg_catalog.array_remove(array[
          case when s.total = 0 then 'Nenhum projeto nos filtros selecionados.' end,
          case when s.cohort_denominator > 0 and s.cohort_denominator < 5 then 'Taxa de conclusão sem amostra mínima de 5 projetos.' end,
          case when s.attention_total > 50 then 'A lista de atenção está limitada aos 50 projetos mais recentes.' end
        ], null))
      ),
      'total', s.total, 'delayed', s.delayed, 'averageDurationDays', s.average_days,
      'completionRate', public.report_rate_json(s.cohort_completed, s.cohort_denominator),
      'byStatus', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.key, 'label', x.key, 'count', x.count) order by x.count desc, x.key)
        from (select status as key, count(*)::bigint as count from base group by status) x
      ), '[]'::jsonb),
      'productivity', coalesce((
        select jsonb_agg(jsonb_build_object('bucket', x.bucket_start, 'label', x.label, 'count', x.completed) order by x.bucket_start)
        from productivity x
      ), '[]'::jsonb),
      'attention', jsonb_build_object(
        'total', s.attention_total, 'delayed', s.delayed,
        'pendingReview', s.pending_review, 'pendingApproval', s.pending_approval,
        'overdueTasks', s.overdue_tasks,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'projectId', x.project_id, 'projectName', x.project_name, 'clientName', x.client_name,
            'service', x.service, 'status', x.status, 'dueDate', x.due_date,
            'reasons', pg_catalog.array_to_json(pg_catalog.array_remove(array[
              case when x.delayed then 'Prazo vencido' end,
              case when x.pending_review then 'Revisão pendente' end,
              case when x.pending_approval then 'Aprovação pendente' end,
              case when x.overdue_tasks then 'Tarefa vencida' end
            ], null))
          ) order by x.due_date nulls last, x.project_name, x.project_id)
          from (select * from attention order by created_at desc, project_id limit 50) x
        ), '[]'::jsonb),
        'truncated', s.attention_total > 50
      )
    from summary s cross join params f
  );
end;
$$;

revoke all on function public.get_report_clients(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.get_report_projects(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_report_clients(timestamptz, timestamptz, text, text, text, text)
  to authenticated;
grant execute on function public.get_report_projects(timestamptz, timestamptz, text, text, text, text)
  to authenticated;
```

- [ ] **Step 3: Executar o teste GREEN e commitar**

Comandos:

```bash
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: totais de clientes, nicho do lead, pendência, histórico sem duplicação, coorte/conclusão de projetos, prazo médio e atenção passando.

```bash
git add supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql
git commit -m "feat: agregar clientes e projetos nos relatórios"
```

---

### Task 6: Implementar Financeiro com ledger, caixa acumulado e vencidos

**Arquivos:**
- Modificar: `supabase/migrations/0010_etapa3_reports.sql`
- Modificar: `supabase/tests/etapa3_reports.sql`

**Interfaces:**
- Produz `get_report_financial(timestamptz,timestamptz,text,text,text,text) returns jsonb`; `p_status` deve ser `null`.
- Recebimentos e estornos usam `received_at`; despesas pagas usam `paid_at`; despesas pendentes usam `expense_date` apenas para recorte/vencimento.
- Saldo de caixa acumulado começa com movimentos anteriores a `p_start`.
- Atrasados usam parcela quando existe; contrato sem parcelas usa vencimento geral.

- [ ] **Step 1: Estender o teste SQL com recebimentos, estorno, despesas e RED**

Inserir imediatamente antes do `rollback;` final:

```sql
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  converted_contract uuid;
  manual_contract uuid;
  receipt jsonb;
  receipt_id uuid;
  paid_expense jsonb;
  pending_expense jsonb;
  cancelled_expense jsonb;
  overdue_client jsonb;
  probe_contract jsonb;
  probe_installment uuid;
  probe_receipt jsonb;
  result jsonb;
begin
  select ct.id into converted_contract
  from public.contracts ct
  join public.lead_client_links lc on lc.id = ct.source_link_id
  join public.leads l on l.id = lc.lead_id
  where l.name = 'Lead Cinco' and l.owner_id = '00000000-0000-4000-8000-000000000001';

  select id into manual_contract from public.contracts
  where client_id in (select id from public.clients where name = 'Cliente manual de relatório')
    and owner_id = '00000000-0000-4000-8000-000000000001';

  receipt := public.record_payment(jsonb_build_object(
    'contract_id', converted_contract, 'type', 'receipt', 'amount', '2000.00',
    'received_at', '2026-11-21T15:00:00Z', 'payment_method', 'pix',
    'idempotency_key', '00000000-0000-4000-8000-000000000901'
  ));
  receipt_id := (receipt ->> 'id')::uuid;
  perform public.record_payment(jsonb_build_object(
    'contract_id', converted_contract, 'type', 'refund', 'amount', '500.00',
    'received_at', '2026-11-22T15:00:00Z', 'payment_method', 'pix',
    'related_payment_id', receipt_id, 'idempotency_key', '00000000-0000-4000-8000-000000000902'
  ));
  perform public.record_payment(jsonb_build_object(
    'contract_id', manual_contract, 'type', 'receipt', 'amount', '250.00',
    'received_at', '2026-11-23T15:00:00Z', 'payment_method', 'transferencia',
    'idempotency_key', '00000000-0000-4000-8000-000000000903'
  ));

  paid_expense := public.create_expense(jsonb_build_object(
    'description', 'Despesa paga de relatório', 'amount', '300.00', 'expense_date', '2026-11-24',
    'due_date', '2026-11-24', 'contract_id', manual_contract
  ));
  perform public.pay_expense((paid_expense ->> 'id')::uuid, jsonb_build_object(
    'paid_at', '2026-11-24T15:00:00Z', 'payment_method', 'pix'
  ));

  pending_expense := public.create_expense(jsonb_build_object(
    'description', 'Despesa pendente vencida', 'amount', '100.00', 'expense_date', '2026-11-20',
    'due_date', '2026-11-21', 'contract_id', manual_contract
  ));
  cancelled_expense := public.create_expense(jsonb_build_object(
    'description', 'Despesa cancelada', 'amount', '999.00', 'expense_date', '2026-11-24',
    'contract_id', manual_contract
  ));
  perform public.cancel_expense((cancelled_expense ->> 'id')::uuid);

  overdue_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente vencido de relatório',
    'city', 'São Paulo', 'state', 'SP', 'niche', 'barbearia', 'status', 'active',
    'service', 'Site', 'total_value', '100.00', 'contracted_at', date '2026-10-01',
    'due_date', date '2026-11-21', 'payment_method', 'pix'
  ));

  result := public.get_report_financial(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, null
  );
  if (result ->> 'contractedActiveCents')::int <> 585050
    or (result ->> 'receivedHistoricalCents')::int <> 175000
    or (result ->> 'pendingCents')::int <> 410050
    or (result ->> 'periodReceiptsCents')::int <> 225000
    or (result ->> 'periodRefundsCents')::int <> 50000
    or (result ->> 'periodNetReceiptsCents')::int <> 175000
    or (result ->> 'periodPaidExpensesCents')::int <> 30000
    or (result ->> 'pendingExpensesCents')::int <> 10000
    or (result ->> 'periodProfitCents')::int <> 145000
    or (result ->> 'overdueCents')::int <> 10000
    or (result ->> 'overdueExpensesCents')::int <> 10000 then
    raise exception 'Financeiro incorreto: %', result;
  end if;
  if (result -> 'cashFlow' -> (jsonb_array_length(result -> 'cashFlow') - 1) ->> 'balanceCents')::int <> 145000 then
    raise exception 'Saldo acumulado não inclui abertura zero e movimentos do período: %', result;
  end if;

  result := public.get_report_financial(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, 'Consultoria'
  );
  if (result ->> 'periodReceiptsCents')::int <> 25000
    or (result ->> 'periodPaidExpensesCents')::int <> 30000
    or (result ->> 'periodProfitCents')::int <> -5000 then
    raise exception 'Filtro de serviço financeiro incorreto: %', result;
  end if;

  savepoint report_allocated_refund_probe;
  probe_contract := public.create_contract(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'client_id', (overdue_client ->> 'id')::uuid,
    'service', 'Consultoria de teste de estorno', 'total_value', '100.00',
    'contracted_at', date '2026-11-01', 'due_date', date '2026-11-20'
  ));
  perform public.replace_contract_installments(
    (probe_contract ->> 'id')::uuid,
    jsonb_build_array(jsonb_build_object('amount', '100.00', 'due_date', '2026-11-20'))
  );
  select id into probe_installment from public.contract_installments
  where contract_id = (probe_contract ->> 'id')::uuid
    and owner_id = '00000000-0000-4000-8000-000000000001';
  probe_receipt := public.record_payment(jsonb_build_object(
    'contract_id', (probe_contract ->> 'id')::uuid, 'type', 'receipt', 'amount', '20.00',
    'received_at', '2026-11-21T15:00:00Z', 'payment_method', 'pix',
    'idempotency_key', '00000000-0000-4000-8000-000000000904',
    'allocations', jsonb_build_array(jsonb_build_object('installment_id', probe_installment, 'amount', '20.00'))
  ));
  perform public.record_payment(jsonb_build_object(
    'contract_id', (probe_contract ->> 'id')::uuid, 'type', 'refund', 'amount', '5.00',
    'received_at', '2026-11-22T15:00:00Z', 'payment_method', 'pix',
    'related_payment_id', (probe_receipt ->> 'id')::uuid,
    'idempotency_key', '00000000-0000-4000-8000-000000000905',
    'allocations', jsonb_build_array(jsonb_build_object('installment_id', probe_installment, 'amount', '5.00'))
  ));
  result := public.get_report_financial(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null,
    'Consultoria de teste de estorno'
  );
  if (result ->> 'pendingCents')::int <> 8500
    or (result ->> 'overdueCents')::int <> 8500
    or (result ->> 'periodNetReceiptsCents')::int <> 1500
    or not exists (
      select 1 from jsonb_array_elements(result -> 'overdue') item
      where item ->> 'contractId' = (probe_contract ->> 'id')::text
        and (item ->> 'remainingCents')::int = 8500
    ) then
    raise exception 'Estorno alocado não reabriu o saldo da parcela: %', result;
  end if;
  rollback to savepoint report_allocated_refund_probe;

  begin
    perform public.get_report_financial(
      '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, 'active', null
    );
    raise exception 'Status financeiro foi aceito.';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_report_financial' and p.prosecdef
  ) then
    raise exception 'RPC financeira marcada security definer.';
  end if;
end;
$$;
```

Comando: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql`
Falha esperada: `get_report_financial` não existe.

- [ ] **Step 2: Inserir a RPC financeira antes de `commit;`**

```sql
create or replace function public.get_report_financial(
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
begin
  perform public.report_validate_period(p_start, p_end);
  if v_status is not null then
    raise exception 'Status não se aplica à visão financeira.' using errcode = '22023';
  end if;

  return (
    with params as (
      select v_niche as niche, v_city as city, v_service as service,
        (now() at time zone 'America/Sao_Paulo')::date as today
    ),
    entries as (
      select f.* from public.report_financial_entries f cross join params p
      where (p.niche is null or f.niche = p.niche)
        and (p.city is null or f.city = p.city)
        and (p.service is null or f.service = p.service)
    ),
    period_entries as (
      select * from entries where occurred_at >= p_start and occurred_at < p_end
    ),
    active_contracts as (
      select ct.id as contract_id, ct.client_id, ct.total_value, ct.due_date,
        cd.client_name, ct.service
      from public.contracts ct
      join public.report_client_dimensions cd on cd.client_id = ct.client_id
      cross join params p
      where ct.status = 'active'
        and (p.niche is null or cd.niche = p.niche)
        and (p.city is null or cd.city = p.city)
        and (p.service is null or ct.service = p.service)
    ),
    balances as (
      select ac.contract_id, ac.client_id, ac.total_value, ac.due_date, ac.client_name, ac.service,
        greatest(ac.total_value - coalesce(net.net_received, 0), 0) as remaining
      from active_contracts ac
      left join lateral (
        select sum(case when p.type = 'receipt' then p.amount else -p.amount end) as net_received
        from public.financial_payments p where p.contract_id = ac.contract_id
      ) net on true
    ),
    installment_rows as (
      select b.contract_id, b.client_name, b.service, i.due_date,
        greatest(i.amount - coalesce(allocated.amount, 0), 0) as remaining
      from balances b
      join public.contract_installments i on i.contract_id = b.contract_id
      left join lateral (
        select sum(case when p.type = 'receipt' then a.amount else -a.amount end) as amount
        from public.financial_payment_allocations a
        join public.financial_payments p
          on p.id = a.payment_id and p.owner_id = a.owner_id and p.contract_id = a.contract_id
        where a.installment_id = i.id
      ) allocated on true
      where greatest(i.amount - coalesce(allocated.amount, 0), 0) > 0
    ),
    general_rows as (
      select b.contract_id, b.client_name, b.service, b.due_date, b.remaining
      from balances b
      where b.due_date is not null and b.remaining > 0
        and not exists (select 1 from public.contract_installments i where i.contract_id = b.contract_id)
    ),
    receivables as (
      select * from installment_rows union all select * from general_rows
    ),
    overdue as (
      select r.* from receivables r cross join params p where r.due_date < p.today
    ),
    upcoming as (
      select r.* from receivables r cross join params p where r.due_date >= p.today
    ),
    opening as (
      select coalesce(sum(case
        when kind = 'receipt' then amount
        when kind = 'refund' then -amount
        when kind = 'expense' and status = 'paid' then -amount
        else 0::numeric end), 0) as amount
      from entries where occurred_at < p_start
    ),
    bucket_totals as (
      select b.bucket_start, b.label,
        coalesce(sum(case when f.kind = 'receipt' then f.amount else 0::numeric end), 0) as receipts,
        coalesce(sum(case when f.kind = 'refund' then f.amount else 0::numeric end), 0) as refunds,
        coalesce(sum(case when f.kind = 'expense' and f.status = 'paid' then f.amount else 0::numeric end), 0) as expenses
      from public.report_buckets(p_start, p_end) b
      left join period_entries f
        on pg_catalog.date_trunc(public.report_bucket(p_start, p_end), f.occurred_at at time zone 'America/Sao_Paulo') = b.bucket_start
      group by b.bucket_start, b.label
    ),
    cash as (
      select x.*, x.receipts - x.refunds - x.expenses as net,
        o.amount + pg_catalog.sum(x.receipts - x.refunds - x.expenses) over (order by x.bucket_start) as balance
      from bucket_totals x cross join opening o
    ),
    summary as (
      select
        (select coalesce(sum(total_value), 0) from active_contracts) as contracted,
        (select coalesce(sum(case when kind = 'receipt' then amount else -amount end), 0) from entries where kind in ('receipt', 'refund')) as historical_received,
        (select coalesce(sum(remaining), 0) from balances) as pending,
        (select coalesce(sum(case when kind = 'receipt' then amount else 0::numeric end), 0) from period_entries) as period_receipts,
        (select coalesce(sum(case when kind = 'refund' then amount else 0::numeric end), 0) from period_entries) as period_refunds,
        (select coalesce(sum(case when kind = 'expense' and status = 'paid' then amount else 0::numeric end), 0) from period_entries) as paid_expenses,
        (select coalesce(sum(amount), 0) from entries where kind = 'expense' and status = 'pending') as pending_expenses,
        (select coalesce(sum(remaining), 0) from overdue) as overdue,
        (select coalesce(sum(amount), 0) from entries e cross join params p
          where e.kind = 'expense' and e.status = 'pending' and e.due_date < p.today) as overdue_expenses,
        (select count(*) from overdue) as overdue_count,
        (select count(*) from upcoming) as upcoming_count
    )
    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(), 'start_date', (p_start at time zone 'America/Sao_Paulo')::date,
        'end_date', ((p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
        'start_at', p_start, 'end_at', p_end,
        'filters', jsonb_build_object('period', null, 'niche', v_niche, 'city', v_city, 'status', null, 'service', v_service),
        'warnings', pg_catalog.array_to_json(pg_catalog.array_remove(array[
          case when s.period_receipts = 0 and s.period_refunds = 0 and s.paid_expenses = 0
            then 'Nenhum movimento financeiro realizado no período.' end,
          case when v_niche is not null or v_city is not null or v_service is not null
            then 'Despesas sem contrato/projeto não podem ser atribuídas aos filtros dimensionais.' end
        ], null))
      ),
      'contractedActiveCents', public.financial_to_cents(s.contracted),
      'receivedHistoricalCents', public.financial_to_cents(s.historical_received),
      'pendingCents', public.financial_to_cents(s.pending),
      'periodReceiptsCents', public.financial_to_cents(s.period_receipts),
      'periodRefundsCents', public.financial_to_cents(s.period_refunds),
      'periodNetReceiptsCents', public.financial_to_cents(s.period_receipts - s.period_refunds),
      'periodPaidExpensesCents', public.financial_to_cents(s.paid_expenses),
      'pendingExpensesCents', public.financial_to_cents(s.pending_expenses),
      'periodProfitCents', public.financial_to_cents(s.period_receipts - s.period_refunds - s.paid_expenses),
      'overdueCents', public.financial_to_cents(s.overdue),
      'overdueExpensesCents', public.financial_to_cents(s.overdue_expenses),
      'cashFlow', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', x.label, 'receiptsCents', public.financial_to_cents(x.receipts),
          'expensesCents', public.financial_to_cents(x.expenses),
          'netCents', public.financial_to_cents(x.net), 'balanceCents', public.financial_to_cents(x.balance)
        ) order by x.bucket_start)
        from cash x
      ), '[]'::jsonb),
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'categoryId', x.category_id, 'name', x.name, 'amountCents', x.amount
        ) order by x.amount desc, x.name)
        from (
          select f.category_id, coalesce(f.category_name, 'Não informado') as name,
            public.financial_to_cents(sum(f.amount))::bigint as amount
          from period_entries f where f.kind = 'expense' and f.status = 'paid'
          group by f.category_id, coalesce(f.category_name, 'Não informado')
        ) x
      ), '[]'::jsonb),
      'paymentMethods', coalesce((
        select jsonb_agg(jsonb_build_object(
          'method', x.method, 'receiptsCents', x.receipts, 'refundsCents', x.refunds
        ) order by x.method)
        from (
          select coalesce(payment_method, 'Não informado') as method,
            public.financial_to_cents(sum(case when kind = 'receipt' then amount else 0::numeric end))::bigint as receipts,
            public.financial_to_cents(sum(case when kind = 'refund' then amount else 0::numeric end))::bigint as refunds
          from period_entries where kind in ('receipt', 'refund') group by coalesce(payment_method, 'Não informado')
        ) x
      ), '[]'::jsonb),
      'overdue', coalesce((
        select jsonb_agg(jsonb_build_object(
          'contractId', x.contract_id, 'clientName', x.client_name, 'service', x.service,
          'dueDate', x.due_date, 'remainingCents', public.financial_to_cents(x.remaining)
        ) order by x.due_date, x.client_name, x.contract_id)
        from (select * from overdue order by due_date, client_name, contract_id limit 50) x
      ), '[]'::jsonb),
      'upcoming', coalesce((
        select jsonb_agg(jsonb_build_object(
          'contractId', x.contract_id, 'clientName', x.client_name, 'service', x.service,
          'dueDate', x.due_date, 'remainingCents', public.financial_to_cents(x.remaining)
        ) order by x.due_date, x.client_name, x.contract_id)
        from (select * from upcoming order by due_date, client_name, contract_id limit 50) x
      ), '[]'::jsonb),
      'listsTruncated', s.overdue_count > 50 or s.upcoming_count > 50
    from summary s
  );
end;
$$;

revoke all on function public.get_report_financial(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_report_financial(timestamptz, timestamptz, text, text, text, text)
  to authenticated;
```

- [ ] **Step 3: Executar o teste GREEN e commitar**

Comandos:

```bash
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: contratado ativo, recebido líquido, pendente, lucro, despesas canceladas fora, vencidos, filtro de serviço e caixa acumulado passando.

```bash
git add supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql
git commit -m "feat: agregar financeiro realizado nos relatórios"
```

---

### Task 7: Implementar Consolidado e export cursorizado com limite de segurança

**Arquivos:**
- Modificar: `supabase/migrations/0010_etapa3_reports.sql`
- Modificar: `supabase/tests/etapa3_reports.sql`

**Interfaces:**
- Produz `get_report_consolidated(timestamptz,timestamptz,text,text,text,text) returns jsonb`.
- Produz `get_report_export(text,timestamptz,timestamptz,text,text,text,text,jsonb,integer) returns jsonb`.
- Produz a view `report_export_detail` com uma linha por módulo/registro e payload JSON estável.
- `get_report_export` retorna `{ rows, next_cursor, total, generated_at }`.

- [ ] **Step 1: Estender o teste SQL com totais, cursor, escopo, mutação e limite RED**

Inserir imediatamente antes do `rollback;` final:

```sql
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  result jsonb;
  page_one jsonb;
  page_two jsonb;
  cursor jsonb;
  next_cursor jsonb;
  seen uuid[] := array[]::uuid[];
  current_id uuid;
  inserted_id uuid;
  consolidated_page jsonb;
  consolidated_cursor jsonb;
  consolidated_next jsonb;
  consolidated_key text;
  consolidated_keys text[] := array[]::text[];
  consolidated_total bigint;
begin
  result := public.get_report_consolidated(
    '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', null, null, null, null
  );
  if (result -> 'totals' ->> 'leads')::int <> 7
    or (result -> 'totals' ->> 'clients')::int <> 3
    or (result -> 'totals' ->> 'projects')::int <> 2
    or (result -> 'totals' ->> 'movements')::int <> 4
    or (result -> 'totals' ->> 'receiptsCents')::int <> 225000
    or (result -> 'totals' ->> 'refundsCents')::int <> 50000
    or (result -> 'totals' ->> 'paidExpensesCents')::int <> 30000
    or (result -> 'totals' ->> 'netCents')::int <> 145000 then
    raise exception 'Consolidado incorreto: %', result;
  end if;

  page_one := public.get_report_export(
    'leads', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
    null, null, null, null, null, 2
  );
  if (page_one ->> 'total')::int <> 7
    or jsonb_array_length(page_one -> 'rows') <> 2
    or page_one -> 'next_cursor' is null then
    raise exception 'Primeira página de export incorreta: %', page_one;
  end if;
  cursor := page_one -> 'next_cursor';
  if cursor ->> 'id' is distinct from page_one -> 'rows' -> 1 ->> 'id'
    or cursor ->> 'occurredAt' is distinct from (
      select pg_catalog.to_char(d.sort_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      from public.report_export_detail d
      where d.module = 'leads' and d.id = (page_one -> 'rows' -> 1 ->> 'id')::uuid
    ) then
    raise exception 'Cursor não representa a última linha retornada: %.', cursor;
  end if;
  for current_id in select (row ->> 'id')::uuid from jsonb_array_elements(page_one -> 'rows') row loop
    seen := array_append(seen, current_id);
  end loop;

  insert into public.leads (owner_id, name, niche, city, status, offered_service, needs, created_at, updated_at)
  values ('00000000-0000-4000-8000-000000000001', 'Lead inserido após cursor', 'barbearia', 'São Paulo',
    'novo', 'Site', array['site'], '2026-11-26T20:00:00Z', '2026-11-26T20:00:00Z')
  returning id into inserted_id;

  loop
    page_two := public.get_report_export(
      'leads', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, null, cursor, 2
    );
    for current_id in select (row ->> 'id')::uuid from jsonb_array_elements(page_two -> 'rows') row loop
      if current_id = any(seen) then
        raise exception 'Cursor duplicou o lead %.', current_id;
      end if;
      seen := array_append(seen, current_id);
    end loop;
    exit when page_two -> 'next_cursor' is null;
    next_cursor := page_two -> 'next_cursor';
    if next_cursor = cursor then
      raise exception 'Cursor repetido.';
    end if;
    cursor := next_cursor;
  end loop;
  if pg_catalog.cardinality(seen) <> 8 or inserted_id <> all(seen)
    or (page_two ->> 'total')::int <> pg_catalog.cardinality(seen) then
    raise exception 'Paginação não preservou os registros: %.', seen;
  end if;

  begin
    perform public.get_report_export(
      'leads', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, 'Site', page_one -> 'next_cursor', 2
    );
    raise exception 'Cursor de outro escopo foi aceito.';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.get_report_export(
      'leads', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, null, null, 1001
    );
    raise exception 'Página acima de 1000 foi aceita.';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.get_report_export(
      'leads', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, 'status inexistente', null, null, 10
    );
    raise exception 'Status canônico inválido foi aceito no export.';
  exception when sqlstate '22023' then null;
  end;

  page_two := public.get_report_export(
    'opportunities', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
    null, null, null, null, null, 10
  );
  if exists (
    select 1 from jsonb_array_elements(page_two -> 'rows') row
    where pg_catalog.jsonb_typeof(row -> 'eligible') <> 'number'
  ) then
    raise exception 'Elegível do export não usa o contrato numérico do parser.';
  end if;

  consolidated_cursor := null;
  loop
    consolidated_page := public.get_report_export(
      'consolidated', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, null, consolidated_cursor, 1
    );
    if jsonb_array_length(consolidated_page -> 'rows') <> 1
      or (consolidated_page -> 'rows' -> 0 ->> 'leads') is null then
      raise exception 'Export consolidado incorreto: %', consolidated_page;
    end if;
    for consolidated_key in
      select (row ->> 'bucket') || '|' || (row ->> 'niche') || '|' || (row ->> 'city') || '|' || (row ->> 'service')
      from jsonb_array_elements(consolidated_page -> 'rows') row
    loop
      if consolidated_key = any(consolidated_keys) then
        raise exception 'Cursor consolidado duplicou a chave %.', consolidated_key;
      end if;
      consolidated_keys := array_append(consolidated_keys, consolidated_key);
    end loop;
    exit when consolidated_page -> 'next_cursor' is null;
    consolidated_next := consolidated_page -> 'next_cursor';
    if consolidated_next = consolidated_cursor then
      raise exception 'Cursor consolidado repetido.';
    end if;
    consolidated_cursor := consolidated_next;
  end loop;
  consolidated_total := (consolidated_page ->> 'total')::bigint;
  if pg_catalog.cardinality(consolidated_keys) <> consolidated_total then
    raise exception 'Paginação consolidada perdeu registros: % de %.', consolidated_keys, consolidated_total;
  end if;

  savepoint report_export_limit;
  insert into public.leads (owner_id, name, status, needs, created_at, updated_at)
  select '00000000-0000-4000-8000-000000000001', 'Limite ' || n, 'novo', array['site'],
    '2026-11-26T21:00:00Z', '2026-11-26T21:00:00Z'
  from generate_series(1, 10001) as n;
  begin
    perform public.get_report_export(
      'leads', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, null, null, 1000
    );
    raise exception 'Export acima de 10000 registros foi aceito.';
  exception when sqlstate '22023' then null;
  end;
  rollback to savepoint report_export_limit;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_report_consolidated', 'get_report_export') and p.prosecdef
  ) then
    raise exception 'RPC consolidada/export marcada security definer.';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.get_report_export(text,timestamptz,timestamptz,text,text,text,text,jsonb,integer)', 'EXECUTE') then
    raise exception 'Export executável por anon.';
  end if;
end;
$$;
```

Comando: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql`
Falha esperada: `get_report_consolidated` não existe.

- [ ] **Step 2: Inserir a view detalhada e a RPC consolidada antes de `commit;`**

```sql
create or replace view public.report_export_detail
with (security_invoker = true)
as
select
  m.module,
  l.created_at as sort_at,
  l.id,
  l.niche,
  l.city,
  l.offered_service as service,
  l.status,
  jsonb_build_object(
    'id', l.id, 'name', l.name, 'niche', l.niche, 'city', l.city, 'state', l.state,
    'status', l.status, 'offered_service', l.offered_service, 'created_at', l.created_at,
    'updated_at', l.updated_at, 'estimated_value', public.financial_to_cents(l.estimated_value),
    'negotiated_value', public.financial_to_cents(l.negotiated_value),
    'contracted_value', public.financial_to_cents(l.contracted_value),
    'needs', pg_catalog.array_to_string(l.needs, ','), 'priority', l.priority,
    'has_website', l.has_website, 'has_instagram', l.has_instagram,
    'linked_client_id', linked.client_id, 'converted_at', linked.converted_at,
    'eligible', case when pg_catalog.cardinality(l.needs) > 0
      and l.status not in ('aceitou', 'perdido', 'nao_interessado') then 1 else 0 end
  ) as payload
from public.leads l
cross join (values ('leads'::text), ('opportunities'::text)) as m(module)
left join lateral (
  select lc.client_id, lc.converted_at from public.lead_client_links lc where lc.lead_id = l.id
) linked on true
where m.module = 'leads' or (
  pg_catalog.cardinality(l.needs) > 0 and l.status not in ('aceitou', 'perdido', 'nao_interessado')
)
union all
select
  'clients', c.created_at, c.client_id, c.niche, c.city, c.service, c.status,
  jsonb_build_object(
    'id', c.client_id, 'name', c.client_name, 'niche', c.niche, 'city', c.city, 'state', c.state,
    'status', c.status, 'source', c.source, 'service', c.service, 'created_at', c.created_at,
    'converted_at', c.converted_at, 'linked_lead_id', c.linked_lead_id
  )
from public.report_client_dimensions c
union all
select
  'projects', p.created_at, p.project_id, p.niche, p.city, p.service, p.status,
  jsonb_build_object(
    'id', p.project_id, 'client_id', p.client_id, 'contract_id', p.contract_id,
    'source_link_id', p.source_link_id, 'name', p.project_name, 'service', p.service,
    'status', p.status, 'start_date', p.start_date, 'due_date', p.due_date,
    'completed_at', p.completed_at, 'delivered_at', p.delivered_at, 'created_at', p.created_at,
    'contracted_value', public.financial_to_cents(p.contracted_value)
  )
from public.report_project_dimensions p
union all
select
  'receipts', f.occurred_at, f.entry_id, f.niche, f.city, f.service, f.kind,
  jsonb_build_object(
    'id', f.entry_id, 'contract_id', f.contract_id, 'client_id', f.client_id,
    'related_payment_id', payment.related_payment_id, 'type', f.kind,
    'amount', public.financial_to_cents(f.amount),
    'received_at', f.occurred_at, 'payment_method', f.payment_method,
    'service', f.service, 'niche', f.niche, 'city', f.city
  )
from public.report_financial_entries f
left join public.financial_payments payment on payment.id = f.entry_id
where f.kind in ('receipt', 'refund')
union all
select
  'expenses', f.occurred_at, f.entry_id, f.niche, f.city, f.service, f.status,
  jsonb_build_object(
    'id', f.entry_id, 'client_id', f.client_id, 'contract_id', f.contract_id, 'project_id', f.project_id,
    'category_id', f.category_id, 'category_name', f.category_name, 'description', e.description,
    'amount', public.financial_to_cents(f.amount), 'expense_date', e.expense_date,
    'due_date', f.due_date, 'paid_at', e.paid_at,
    'status', f.status, 'payment_method', f.payment_method, 'service', f.service, 'niche', f.niche, 'city', f.city
  )
from public.report_financial_entries f
join public.financial_expenses e on e.id = f.entry_id
where f.kind = 'expense' and f.status <> 'cancelled';

create or replace function public.get_report_consolidated(
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
begin
  perform public.report_validate_period(p_start, p_end);
  if v_status is not null then
    raise exception 'Status não se aplica à visão consolidada.' using errcode = '22023';
  end if;

  return (
    with params as (select v_niche as niche, v_city as city, v_service as service),
    facts as (
      select f.* from public.report_consolidated_facts f cross join params p
      where f.occurred_at >= p_start and f.occurred_at < p_end
        and (p.niche is null or f.niche = p.niche)
        and (p.city is null or f.city = p.city)
        and (p.service is null or f.service = p.service)
    ),
    summary as (
      select
        count(*) filter (where entity_type = 'lead') as leads,
        count(*) filter (where entity_type = 'client') as clients,
        count(*) filter (where entity_type = 'project') as projects,
        count(*) filter (where entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(receipt_value), 0) as receipts,
        coalesce(sum(refund_value), 0) as refunds,
        coalesce(sum(expense_value), 0) as expenses,
        coalesce(sum(estimated_value), 0) as estimated,
        coalesce(sum(negotiated_value), 0) as negotiated,
        coalesce(sum(case when entity_type = 'lead' then contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(contract_value), 0) as contract_contracted,
        coalesce(sum(project_value), 0) as project_contracted
      from facts
    ),
    period_groups as (
      select b.bucket_start, b.label,
        count(f.entity_id) filter (where f.entity_type = 'lead') as leads,
        count(f.entity_id) filter (where f.entity_type = 'client') as clients,
        count(f.entity_id) filter (where f.entity_type = 'project') as projects,
        count(f.entity_id) filter (where f.entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(f.receipt_value), 0) as receipts,
        coalesce(sum(f.refund_value), 0) as refunds,
        coalesce(sum(f.expense_value), 0) as expenses,
        coalesce(sum(f.estimated_value), 0) as estimated,
        coalesce(sum(f.negotiated_value), 0) as negotiated,
        coalesce(sum(case when f.entity_type = 'lead' then f.contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(f.contract_value), 0) as contract_contracted,
        coalesce(sum(f.project_value), 0) as project_contracted
      from public.report_buckets(p_start, p_end) b
      left join facts f on pg_catalog.date_trunc(public.report_bucket(p_start, p_end), f.occurred_at at time zone 'America/Sao_Paulo') = b.bucket_start
      group by b.bucket_start, b.label
    ),
    niche_groups as (
      select coalesce(niche, 'Não informado') as niche,
        count(*) filter (where entity_type = 'lead') as leads,
        count(*) filter (where entity_type = 'client') as clients,
        count(*) filter (where entity_type = 'project') as projects,
        count(*) filter (where entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(receipt_value), 0) as receipts, coalesce(sum(refund_value), 0) as refunds,
        coalesce(sum(expense_value), 0) as expenses, coalesce(sum(estimated_value), 0) as estimated,
        coalesce(sum(negotiated_value), 0) as negotiated,
        coalesce(sum(case when entity_type = 'lead' then contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(contract_value), 0) as contract_contracted, coalesce(sum(project_value), 0) as project_contracted
      from facts group by coalesce(niche, 'Não informado')
    ),
    city_groups as (
      select coalesce(city, 'Não informado') as city,
        count(*) filter (where entity_type = 'lead') as leads,
        count(*) filter (where entity_type = 'client') as clients,
        count(*) filter (where entity_type = 'project') as projects,
        count(*) filter (where entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(receipt_value), 0) as receipts, coalesce(sum(refund_value), 0) as refunds,
        coalesce(sum(expense_value), 0) as expenses, coalesce(sum(estimated_value), 0) as estimated,
        coalesce(sum(negotiated_value), 0) as negotiated,
        coalesce(sum(case when entity_type = 'lead' then contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(contract_value), 0) as contract_contracted, coalesce(sum(project_value), 0) as project_contracted
      from facts group by coalesce(city, 'Não informado')
    ),
    service_groups as (
      select coalesce(service, 'Não informado') as service,
        count(*) filter (where entity_type = 'lead') as leads,
        count(*) filter (where entity_type = 'client') as clients,
        count(*) filter (where entity_type = 'project') as projects,
        count(*) filter (where entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(receipt_value), 0) as receipts, coalesce(sum(refund_value), 0) as refunds,
        coalesce(sum(expense_value), 0) as expenses, coalesce(sum(estimated_value), 0) as estimated,
        coalesce(sum(negotiated_value), 0) as negotiated,
        coalesce(sum(case when entity_type = 'lead' then contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(contract_value), 0) as contract_contracted, coalesce(sum(project_value), 0) as project_contracted
      from facts group by coalesce(service, 'Não informado')
    ),
    cross_groups as (
      select pg_catalog.date_trunc(public.report_bucket(p_start, p_end), occurred_at at time zone 'America/Sao_Paulo') as bucket_start,
        coalesce(niche, 'Não informado') as niche, coalesce(city, 'Não informado') as city,
        coalesce(service, 'Não informado') as service,
        count(*) filter (where entity_type = 'lead') as leads,
        count(*) filter (where entity_type = 'client') as clients,
        count(*) filter (where entity_type = 'project') as projects,
        count(*) filter (where entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(receipt_value), 0) as receipts, coalesce(sum(refund_value), 0) as refunds,
        coalesce(sum(expense_value), 0) as expenses, coalesce(sum(estimated_value), 0) as estimated,
        coalesce(sum(negotiated_value), 0) as negotiated,
        coalesce(sum(case when entity_type = 'lead' then contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(contract_value), 0) as contract_contracted, coalesce(sum(project_value), 0) as project_contracted
      from facts
      group by 1, 2, 3, 4
    ),
    cross_counted as (
      select x.*, pg_catalog.row_number() over (order by bucket_start desc, niche desc, city desc, service desc) as position,
        count(*) over () as total
      from cross_groups x
    )
    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(), 'start_date', (p_start at time zone 'America/Sao_Paulo')::date,
        'end_date', ((p_end - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date,
        'start_at', p_start, 'end_at', p_end,
        'filters', jsonb_build_object('period', null, 'niche', v_niche, 'city', v_city, 'status', null, 'service', v_service),
        'warnings', pg_catalog.array_to_json(pg_catalog.array_remove(array[
          case when (select leads + clients + projects + movements from summary) = 0
            then 'Nenhum fato no período e nos filtros selecionados.' end,
          case when (select total from cross_counted limit 1) > 200
            then 'Os cruzamentos estão limitados aos 200 grupos mais recentes; o export contém todos.' end
        ], null))
      ),
      'totals', jsonb_build_object(
        'leads', s.leads, 'clients', s.clients, 'projects', s.projects, 'movements', s.movements,
        'receiptsCents', public.financial_to_cents(s.receipts), 'refundsCents', public.financial_to_cents(s.refunds),
        'paidExpensesCents', public.financial_to_cents(s.expenses),
        'netCents', public.financial_to_cents(s.receipts - s.refunds - s.expenses),
        'leadEstimatedCents', public.financial_to_cents(s.estimated),
        'leadNegotiatedCents', public.financial_to_cents(s.negotiated),
        'leadContractedSnapshotCents', public.financial_to_cents(s.lead_contracted),
        'contractContractedCents', public.financial_to_cents(s.contract_contracted),
        'projectContractedCents', public.financial_to_cents(s.project_contracted)
      ),
      'byPeriod', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', x.bucket_start, 'niche', 'Todos', 'city', 'Todas', 'service', 'Todos',
          'leads', x.leads, 'clients', x.clients, 'projects', x.projects, 'movements', x.movements,
          'receiptsCents', public.financial_to_cents(x.receipts), 'refundsCents', public.financial_to_cents(x.refunds),
          'paidExpensesCents', public.financial_to_cents(x.expenses),
          'leadEstimatedCents', public.financial_to_cents(x.estimated),
          'leadNegotiatedCents', public.financial_to_cents(x.negotiated),
          'leadContractedSnapshotCents', public.financial_to_cents(x.lead_contracted),
          'contractContractedCents', public.financial_to_cents(x.contract_contracted),
          'projectContractedCents', public.financial_to_cents(x.project_contracted)
        ) order by x.bucket_start)
        from period_groups x
      ), '[]'::jsonb),
      'byNiche', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', 'Todos', 'niche', x.niche, 'city', 'Todas', 'service', 'Todos',
          'leads', x.leads, 'clients', x.clients, 'projects', x.projects, 'movements', x.movements,
          'receiptsCents', public.financial_to_cents(x.receipts), 'refundsCents', public.financial_to_cents(x.refunds),
          'paidExpensesCents', public.financial_to_cents(x.expenses),
          'leadEstimatedCents', public.financial_to_cents(x.estimated),
          'leadNegotiatedCents', public.financial_to_cents(x.negotiated),
          'leadContractedSnapshotCents', public.financial_to_cents(x.lead_contracted),
          'contractContractedCents', public.financial_to_cents(x.contract_contracted),
          'projectContractedCents', public.financial_to_cents(x.project_contracted)
        ) order by x.movements desc, x.leads desc, x.niche)
        from (select * from niche_groups order by movements desc, leads desc, niche limit 50) x
      ), '[]'::jsonb),
      'byCity', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', 'Todos', 'niche', 'Todos', 'city', x.city, 'service', 'Todos',
          'leads', x.leads, 'clients', x.clients, 'projects', x.projects, 'movements', x.movements,
          'receiptsCents', public.financial_to_cents(x.receipts), 'refundsCents', public.financial_to_cents(x.refunds),
          'paidExpensesCents', public.financial_to_cents(x.expenses),
          'leadEstimatedCents', public.financial_to_cents(x.estimated),
          'leadNegotiatedCents', public.financial_to_cents(x.negotiated),
          'leadContractedSnapshotCents', public.financial_to_cents(x.lead_contracted),
          'contractContractedCents', public.financial_to_cents(x.contract_contracted),
          'projectContractedCents', public.financial_to_cents(x.project_contracted)
        ) order by x.movements desc, x.leads desc, x.city)
        from (select * from city_groups order by movements desc, leads desc, city limit 50) x
      ), '[]'::jsonb),
      'byService', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', 'Todos', 'niche', 'Todos', 'city', 'Todas', 'service', x.service,
          'leads', x.leads, 'clients', x.clients, 'projects', x.projects, 'movements', x.movements,
          'receiptsCents', public.financial_to_cents(x.receipts), 'refundsCents', public.financial_to_cents(x.refunds),
          'paidExpensesCents', public.financial_to_cents(x.expenses),
          'leadEstimatedCents', public.financial_to_cents(x.estimated),
          'leadNegotiatedCents', public.financial_to_cents(x.negotiated),
          'leadContractedSnapshotCents', public.financial_to_cents(x.lead_contracted),
          'contractContractedCents', public.financial_to_cents(x.contract_contracted),
          'projectContractedCents', public.financial_to_cents(x.project_contracted)
        ) order by x.movements desc, x.leads desc, x.service)
        from (select * from service_groups order by movements desc, leads desc, service limit 50) x
      ), '[]'::jsonb),
      'crossBuckets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'bucket', x.bucket_start, 'niche', x.niche, 'city', x.city, 'service', x.service,
          'leads', x.leads, 'clients', x.clients, 'projects', x.projects, 'movements', x.movements,
          'receiptsCents', public.financial_to_cents(x.receipts), 'refundsCents', public.financial_to_cents(x.refunds),
          'paidExpensesCents', public.financial_to_cents(x.expenses),
          'leadEstimatedCents', public.financial_to_cents(x.estimated),
          'leadNegotiatedCents', public.financial_to_cents(x.negotiated),
          'leadContractedSnapshotCents', public.financial_to_cents(x.lead_contracted),
          'contractContractedCents', public.financial_to_cents(x.contract_contracted),
          'projectContractedCents', public.financial_to_cents(x.project_contracted)
        ) order by x.bucket_start, x.niche, x.city, x.service)
        from (select * from cross_counted where position <= 200 order by position) x
      ), '[]'::jsonb),
      'crossBucketsTruncated', coalesce((select total > 200 from cross_counted limit 1), false),
      'groupsTruncated', (select count(*) from niche_groups) > 50
        or (select count(*) from city_groups) > 50 or (select count(*) from service_groups) > 50
    from summary s
  );
end;
$$;
```

- [ ] **Step 3: Inserir a RPC de export e concluir os grants**

```sql
create or replace function public.get_report_export(
  p_module text,
  p_start timestamptz,
  p_end timestamptz,
  p_niche text default null,
  p_city text default null,
  p_status text default null,
  p_service text default null,
  p_cursor jsonb default null,
  p_limit integer default 1000
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_module text := lower(pg_catalog.btrim(p_module));
  v_niche text := public.report_normalize_niche(p_niche);
  v_city text := nullif(pg_catalog.btrim(p_city), '');
  v_status text := nullif(pg_catalog.btrim(p_status), '');
  v_service text := nullif(pg_catalog.btrim(p_service), '');
  v_scope text;
  v_total bigint;
  v_rows jsonb := '[]'::jsonb;
  v_next jsonb;
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_cursor_bucket timestamp;
  v_cursor_niche text;
  v_cursor_city text;
  v_cursor_service text;
begin
  perform public.report_validate_period(p_start, p_end);
  if v_module not in ('leads', 'opportunities', 'clients', 'projects', 'receipts', 'expenses', 'consolidated') then
    raise exception 'Módulo de export inválido.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'O limite da página deve estar entre 1 e 1000.' using errcode = '22023';
  end if;
  if v_module in ('leads', 'opportunities') and v_status is not null and v_status <> all (array[
    'novo', 'contato_realizado', 'aguardando_resposta', 'pediu_informacoes',
    'interessado', 'negociando', 'aceitou', 'ignorou', 'nao_interessado', 'follow_up', 'perdido'
  ]) then
    raise exception 'Status de lead inválido.' using errcode = '22023';
  end if;
  if v_module = 'clients' and v_status is not null and v_status <> all (array[
    'active', 'in_project', 'awaiting_payment', 'awaiting_approval', 'project_completed', 'inactive'
  ]) then
    raise exception 'Status de cliente inválido.' using errcode = '22023';
  end if;
  if v_module = 'projects' and v_status is not null and v_status <> all (array[
    'not_started', 'planning', 'in_development', 'awaiting_client_info', 'in_review',
    'awaiting_approval', 'changes_requested', 'completed', 'delivered', 'cancelled'
  ]) then
    raise exception 'Status de projeto inválido.' using errcode = '22023';
  end if;
  if v_module in ('receipts', 'expenses', 'consolidated') and v_status is not null then
    raise exception 'Status não se aplica a este módulo de export.' using errcode = '22023';
  end if;

  v_scope := public.report_export_scope(v_module, p_start, p_end, v_niche, v_city, v_status, v_service);
  if p_cursor is not null then
    if pg_catalog.jsonb_typeof(p_cursor) <> 'object' or p_cursor ->> 'scope' is distinct from v_scope then
      raise exception 'Cursor inválido ou pertencente a outro escopo.' using errcode = '22023';
    end if;
  end if;

  if v_module <> 'consolidated' then
    if p_cursor is not null then
      begin
        v_cursor_at := (p_cursor ->> 'occurredAt')::timestamptz;
        v_cursor_id := (p_cursor ->> 'id')::uuid;
      exception when others then
        raise exception 'Cursor detalhado inválido.' using errcode = '22023';
      end;
      if v_cursor_at is null or v_cursor_id is null then
        raise exception 'Cursor detalhado incompleto.' using errcode = '22023';
      end if;
    end if;

    with filtered as (
      select d.* from public.report_export_detail d
      where d.module = v_module and d.sort_at >= p_start and d.sort_at < p_end
        and (v_niche is null or d.niche = v_niche)
        and (v_city is null or d.city = v_city)
        and (v_service is null or d.service = v_service)
        and (v_status is null or d.status = v_status)
    ), counted as (
      select count(*)::bigint as total from filtered
    ), page as (
      select f.* from filtered f
      where v_cursor_at is null or (f.sort_at, f.id) > (v_cursor_at, v_cursor_id)
      order by f.sort_at, f.id
      limit p_limit + 1
    ), visible as (
      select * from page limit p_limit
    ), last_visible as (
      select * from visible order by sort_at desc, id desc limit 1
    ), next_row as (
      select * from page offset p_limit limit 1
    )
    select c.total into v_total from counted c;

    if v_total > 10000 then
      raise exception 'A exportação excede o limite de 10.000 registros.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(x.payload order by x.sort_at, x.id), '[]'::jsonb) into v_rows from visible x;
    select jsonb_build_object(
      'scope', v_scope,
      'occurredAt', pg_catalog.to_char(x.sort_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'id', x.id
    ) into v_next from last_visible x
    where exists (select 1 from next_row);
  else
    if p_cursor is not null then
      begin
        v_cursor_bucket := (p_cursor ->> 'bucket')::timestamp;
        v_cursor_niche := p_cursor ->> 'niche';
        v_cursor_city := p_cursor ->> 'city';
        v_cursor_service := p_cursor ->> 'service';
      exception when others then
        raise exception 'Cursor consolidado inválido.' using errcode = '22023';
      end;
      if v_cursor_bucket is null or v_cursor_niche is null or v_cursor_city is null or v_cursor_service is null then
        raise exception 'Cursor consolidado incompleto.' using errcode = '22023';
      end if;
    end if;

    with facts as (
      select f.* from public.report_consolidated_facts f
      where f.occurred_at >= p_start and f.occurred_at < p_end
        and (v_niche is null or f.niche = v_niche)
        and (v_city is null or f.city = v_city)
        and (v_service is null or f.service = v_service)
    ), grouped as (
      select pg_catalog.date_trunc(public.report_bucket(p_start, p_end), occurred_at at time zone 'America/Sao_Paulo') as bucket_start,
        coalesce(niche, 'Não informado') as niche, coalesce(city, 'Não informado') as city,
        coalesce(service, 'Não informado') as service,
        count(*) filter (where entity_type = 'lead') as leads,
        count(*) filter (where entity_type = 'client') as clients,
        count(*) filter (where entity_type = 'project') as projects,
        count(*) filter (where entity_type in ('payment', 'expense')) as movements,
        coalesce(sum(receipt_value), 0) as receipts, coalesce(sum(refund_value), 0) as refunds,
        coalesce(sum(expense_value), 0) as expenses, coalesce(sum(estimated_value), 0) as estimated,
        coalesce(sum(negotiated_value), 0) as negotiated,
        coalesce(sum(case when entity_type = 'lead' then contracted_value else 0::numeric end), 0) as lead_contracted,
        coalesce(sum(contract_value), 0) as contract_contracted, coalesce(sum(project_value), 0) as project_contracted
      from facts group by 1, 2, 3, 4
    ), counted as (
      select count(*)::bigint as total from grouped
    ), page as (
      select g.* from grouped g
      where v_cursor_bucket is null
        or (g.bucket_start, g.niche, g.city, g.service) > (v_cursor_bucket, v_cursor_niche, v_cursor_city, v_cursor_service)
      order by g.bucket_start, g.niche, g.city, g.service
      limit p_limit + 1
    ), visible as (
      select p.*, jsonb_build_object(
        'bucket', p.bucket_start, 'niche', p.niche, 'city', p.city, 'service', p.service,
        'leads', p.leads, 'clients', p.clients, 'projects', p.projects, 'movements', p.movements,
        'receipts_cents', public.financial_to_cents(p.receipts), 'refunds_cents', public.financial_to_cents(p.refunds),
        'paid_expenses_cents', public.financial_to_cents(p.expenses),
        'lead_estimated_cents', public.financial_to_cents(p.estimated),
        'lead_negotiated_cents', public.financial_to_cents(p.negotiated),
        'lead_contracted_cents', public.financial_to_cents(p.lead_contracted),
        'contract_contracted_cents', public.financial_to_cents(p.contract_contracted),
        'project_contracted_cents', public.financial_to_cents(p.project_contracted)
      ) as payload
      from page p limit p_limit
    ), last_visible as (
      select * from visible order by bucket_start desc, niche desc, city desc, service desc limit 1
    ), next_row as (
      select * from page offset p_limit limit 1
    )
    select c.total into v_total from counted c;

    if v_total > 10000 then
      raise exception 'A exportação excede o limite de 10.000 registros.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(x.payload order by x.bucket_start, x.niche, x.city, x.service), '[]'::jsonb)
      into v_rows from visible x;
    select jsonb_build_object(
      'scope', v_scope, 'bucket', x.bucket_start, 'niche', x.niche, 'city', x.city, 'service', x.service
    ) into v_next from last_visible x
    where exists (select 1 from next_row);
  end if;

  return jsonb_build_object(
    'rows', v_rows, 'next_cursor', v_next, 'total', v_total, 'generated_at', now()
  );
end;
$$;

revoke all on function public.get_report_consolidated(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.get_report_export(text, timestamptz, timestamptz, text, text, text, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on public.report_export_detail from public, anon, authenticated;
grant select on public.report_export_detail to authenticated;
grant execute on function public.get_report_consolidated(timestamptz, timestamptz, text, text, text, text)
  to authenticated;
grant execute on function public.get_report_export(text, timestamptz, timestamptz, text, text, text, text, jsonb, integer)
  to authenticated;
```

- [ ] **Step 4: Executar o teste GREEN e commitar**

Comandos:

```bash
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: totais consolidados sem duplicação, export completo por cursor, rejeição de escopo/limite inválido, mutação posterior sem duplicação e aborto acima de 10.000 registros.

```bash
git add supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql
git commit -m "feat: adicionar consolidado e export cursorizado"
```

---

### Task 8: Criar o serviço Supabase, parsers e paginação completa do export

**Arquivos:**
- Criar: `src/services/reportService.ts`
- Criar: `src/services/reportService.test.ts`
- Modificar: `supabase/migrations/0010_etapa3_reports.sql`
- Modificar: `supabase/tests/etapa3_reports.sql`

**Interfaces:**
- Produz `loadReportData`, `getReportFilterOptions` e `exportReport`.
- `exportReport` só retorna `ReportExportFile` depois de todas as páginas; não expõe arquivo parcial.
- Parsers rejeitam payload ausente, tipo incorreto, centavos inseguros e cursor repetido.

- [ ] **Step 1: Adicionar o teste SQL das opções reais de filtro e da validação de nicho**

Inserir imediatamente antes do `rollback;` final:

```sql
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  result jsonb;
  function_name text;
begin
  result := public.get_report_filter_options();
  if not (result -> 'cities') ? 'São Paulo'
    or not (result -> 'cities') ? 'Campinas'
    or not (result -> 'cities') ? 'Santos'
    or not (result -> 'services') ? 'Site'
    or not (result -> 'services') ? 'Consultoria'
    or not (result -> 'services') ? 'Cardápio' then
    raise exception 'Opções de filtro não usam dados reais: %', result;
  end if;

  for function_name in select unnest(array[
    'get_report_prospecting', 'get_report_opportunities', 'get_report_clients',
    'get_report_projects', 'get_report_financial', 'get_report_consolidated'
  ]) loop
    begin
      execute format(
        'select public.%I(%L::timestamptz, %L::timestamptz, %L::text, null, null, null)',
        function_name, '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', 'nicho inexistente'
      );
      raise exception 'RPC % aceitou nicho inválido.', function_name;
    exception when sqlstate '22023' then null;
    end;
    execute format(
      'select public.%I(%L::timestamptz, %L::timestamptz, %L::text, null, null, null)',
      function_name, '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z', '   '
    ) into result;
    if result is null then
      raise exception 'RPC % rejeitou nicho vazio.', function_name;
    end if;
  end loop;

  begin
    perform public.get_report_export(
      'leads', '2026-11-20T03:00:00Z'::timestamptz, '2026-11-27T03:00:00Z'::timestamptz,
      'nicho inexistente', null, null, null, null, 1000
    );
    raise exception 'Export aceitou nicho inválido.';
  exception when sqlstate '22023' then null;
  end;
  result := public.get_report_export(
    'leads', '2026-11-20T03:00:00Z'::timestamptz, '2026-11-27T03:00:00Z'::timestamptz,
    '   ', null, null, null, null, 1000
  );
  if result is null then
    raise exception 'Export rejeitou nicho vazio.';
  end if;
end;
$$;

reset role;

do $$
declare
  function_name text;
  function_oid oid;
  view_name text;
begin
  foreach function_name in array array[
    'report_require_session', 'report_validate_period', 'report_normalize_niche',
    'report_bucket', 'report_buckets', 'report_rate', 'report_rate_json',
    'report_export_scope', 'get_report_prospecting',
    'get_report_opportunities', 'get_report_clients', 'get_report_projects',
    'get_report_financial', 'get_report_consolidated', 'get_report_export',
    'get_report_filter_options'
  ] loop
    select p.oid into function_oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = function_name
      and not p.prosecdef and 'search_path=""' = any(p.proconfig);
    if function_oid is null then
      raise exception 'Função % sem security invoker/search_path vazio.', function_name;
    end if;
    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE') then
      raise exception 'EXECUTE incorreto na função %.', function_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(p.proacl) a
      where p.oid = function_oid and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception 'Função % concedida a PUBLIC.', function_name;
    end if;
    function_oid := null;
  end loop;

  foreach view_name in array array[
    'report_client_dimensions', 'report_project_dimensions', 'report_financial_entries',
    'report_consolidated_facts', 'report_export_detail'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = view_name
        and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']
    ) then
      raise exception 'View % sem security_invoker.', view_name;
    end if;
    if pg_catalog.has_table_privilege('anon', format('public.%I', view_name), 'SELECT')
      or not pg_catalog.has_table_privilege('authenticated', format('public.%I', view_name), 'SELECT') then
      raise exception 'SELECT incorreto na view %.', view_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      cross join lateral pg_catalog.aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relname = view_name
        and a.grantee = 0 and a.privilege_type = 'SELECT'
    ) then
      raise exception 'View % concedida a PUBLIC.', view_name;
    end if;
  end loop;
end;
$$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.report_client_dimensions) <> 0
    or (select count(*) from public.report_project_dimensions) <> 0
    or (select count(*) from public.report_financial_entries) <> 0
    or (select count(*) from public.report_consolidated_facts) <> 0
    or (select count(*) from public.report_export_detail) <> 0 then
    raise exception 'Uma view de relatório vazou dados entre owners.';
  end if;
  if (public.get_report_filter_options() -> 'cities') <> '[]'::jsonb
    or (public.get_report_filter_options() -> 'services') <> '[]'::jsonb then
    raise exception 'Opções de filtro vazaram dados entre owners.';
  end if;
end;
$$;

do $$
declare
  owner_two_lead uuid;
  owner_two_eligible uuid;
  conversion jsonb;
  owner_two_client uuid;
  owner_two_contract uuid;
  owner_two_project uuid;
  owner_two_receipt uuid;
  owner_two_expense uuid;
  owner_two_ids uuid[];
  expected_ids uuid[];
  current_id uuid;
  module_name text;
  export_page jsonb;
  consolidated_page jsonb;
begin
  insert into public.leads (owner_id, name, niche, city, state, status, offered_service,
    estimated_value, negotiated_value, contracted_value, needs, priority,
    has_instagram, has_website, created_at, updated_at)
  values ('00000000-0000-4000-8000-000000000002', 'Lead convertido sintético owner 2',
    'clinica_estetica', 'Campinas', 'SP', 'novo', 'Consultoria isolamento owner 2',
    250, 250, 0, array['site'], 'media', 'yes', 'no',
    '2026-11-21T12:00:00Z', '2026-11-21T12:00:00Z')
  returning id into owner_two_lead;

  insert into public.leads (owner_id, name, niche, city, state, status, offered_service,
    estimated_value, negotiated_value, contracted_value, needs, priority,
    has_instagram, has_website, created_at, updated_at)
  values ('00000000-0000-4000-8000-000000000002', 'Lead elegível sintético owner 2',
    'clinica_estetica', 'Campinas', 'SP', 'novo', 'Consultoria isolamento owner 2',
    100, 100, 0, array['site'], 'baixa', 'yes', 'no',
    '2026-11-22T12:00:00Z', '2026-11-22T12:00:00Z')
  returning id into owner_two_eligible;

  conversion := public.convert_lead_to_client(
    owner_two_lead, 'Consultoria isolamento owner 2', 250.00, date '2026-11-23',
    'pix', null, null, 'Projeto sintético owner 2', date '2026-11-23', date '2026-12-01'
  );
  owner_two_client := (conversion ->> 'client_id')::uuid;
  owner_two_contract := (conversion ->> 'contract_id')::uuid;
  owner_two_project := (conversion ->> 'project_id')::uuid;

  owner_two_receipt := (public.record_payment(jsonb_build_object(
    'contract_id', owner_two_contract, 'type', 'receipt', 'amount', '50.00',
    'received_at', '2026-11-26T15:00:00Z', 'payment_method', 'pix',
    'idempotency_key', '00000000-0000-4000-8000-000000000911'
  )) ->> 'id')::uuid;

  owner_two_expense := (public.create_expense(jsonb_build_object(
    'description', 'Despesa paga sintética owner 2', 'amount', '20.00',
    'expense_date', '2026-11-26', 'due_date', '2026-11-26',
    'contract_id', owner_two_contract, 'project_id', owner_two_project
  )) ->> 'id')::uuid;
  perform public.pay_expense(owner_two_expense, jsonb_build_object(
    'paid_at', '2026-11-26T16:00:00Z', 'payment_method', 'pix'
  ));

  owner_two_ids := array[owner_two_lead, owner_two_eligible, owner_two_client,
    owner_two_contract, owner_two_project, owner_two_receipt, owner_two_expense];

  if (select count(*) from public.report_export_detail) <> 7
    or exists (select 1 from public.report_export_detail where id <> all(owner_two_ids)) then
    raise exception 'report_export_detail não isolou integralmente o owner 2.';
  end if;
  if not (public.get_report_filter_options() -> 'services') ? 'Consultoria isolamento owner 2' then
    raise exception 'Opções do owner 2 não incluem seu serviço sintético.';
  end if;

  foreach module_name in array array['leads', 'opportunities', 'clients', 'projects', 'receipts', 'expenses'] loop
    expected_ids := case module_name
      when 'leads' then array[owner_two_lead, owner_two_eligible]
      when 'opportunities' then array[owner_two_eligible]
      when 'clients' then array[owner_two_client]
      when 'projects' then array[owner_two_project]
      when 'receipts' then array[owner_two_receipt]
      when 'expenses' then array[owner_two_expense]
    end;
    export_page := public.get_report_export(
      module_name, '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, null, null, 1000
    );
    if export_page -> 'next_cursor' is not null
      or (export_page ->> 'total')::int <> pg_catalog.cardinality(expected_ids)
      or pg_catalog.cardinality(expected_ids) <> jsonb_array_length(export_page -> 'rows') then
      raise exception 'Export do owner 2 incompleto em %: %', module_name, export_page;
    end if;
    for current_id in select (row ->> 'id')::uuid from jsonb_array_elements(export_page -> 'rows') row loop
      if current_id <> all(expected_ids) then
        raise exception 'Export do owner 2 vazou outro registro em %: %.', module_name, current_id;
      end if;
    end loop;
    if not expected_ids <@ (
      select pg_catalog.array_agg((row ->> 'id')::uuid)
      from jsonb_array_elements(export_page -> 'rows') row
    ) then
      raise exception 'Export do owner 2 omitiu seus registros em %.', module_name;
    end if;
  end loop;

  consolidated_page := public.get_report_export(
    'consolidated', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
    null, null, null, null, null, 1000
  );
  if jsonb_array_length(consolidated_page -> 'rows') <> 1
    or (consolidated_page -> 'rows' -> 0 ->> 'niche') <> 'clinica_estetica'
    or (consolidated_page -> 'rows' -> 0 ->> 'city') <> 'Campinas'
    or (consolidated_page -> 'rows' -> 0 ->> 'service') <> 'Consultoria isolamento owner 2'
    or (consolidated_page -> 'rows' -> 0 ->> 'leads')::int <> 2
    or (consolidated_page -> 'rows' -> 0 ->> 'clients')::int <> 1
    or (consolidated_page -> 'rows' -> 0 ->> 'projects')::int <> 1
    or (consolidated_page -> 'rows' -> 0 ->> 'movements')::int <> 2 then
    raise exception 'Consolidado do owner 2 incorreto ou contaminado: %', consolidated_page;
  end if;

  -- A lista de IDs permanece na mesma transação variável; alternar o claim comprova a direção
  -- inversa sem tentar ler dados do owner 2 através de RLS.
  select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

  foreach module_name in array array['leads', 'opportunities', 'clients', 'projects', 'receipts', 'expenses'] loop
    export_page := public.get_report_export(
      module_name, '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
      null, null, null, null, null, 1000
    );
    if (export_page ->> 'total')::int = 0 then
      raise exception 'Fixture do owner 1 ausente na prova bidirecional de %.', module_name;
    end if;
    if exists (
      select 1 from jsonb_array_elements(export_page -> 'rows') row
      where (row ->> 'id')::uuid = any(owner_two_ids)
    ) then
      raise exception 'Export do owner 1 vazou registro do owner 2 em %.', module_name;
    end if;
  end loop;

  export_page := public.get_report_export(
    'consolidated', '2026-11-20T03:00:00Z', '2026-11-27T03:00:00Z',
    null, null, null, null, null, 1000
  );
  if exists (
    select 1 from jsonb_array_elements(export_page -> 'rows') row
    where row ->> 'niche' = 'clinica_estetica'
      and row ->> 'city' = 'Campinas'
      and row ->> 'service' = 'Consultoria isolamento owner 2'
  ) then
    raise exception 'Consolidado do owner 1 vazou dimensões do owner 2.';
  end if;
  if (public.get_report_filter_options() -> 'services') ? 'Consultoria isolamento owner 2'
    or exists (select 1 from public.report_export_detail where id = any(owner_two_ids)) then
    raise exception 'View ou opções do owner 1 vazaram dados do owner 2.';
  end if;
end;
$$;

reset role;
```

Comando: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql`
Falha esperada: `get_report_filter_options` não existe.

- [ ] **Step 2: Escrever os testes RED do serviço**

Criar `src/services/reportService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportReport, getReportFilterOptions, loadReportData } from './reportService'

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn<(name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>>(),
}))

vi.mock('../lib/db', () => ({
  requireSupabase: () => ({ rpc }),
  throwDbError: (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  },
}))

const meta = {
  generated_at: '2026-11-26T12:00:00Z', start_date: '2026-11-25', end_date: '2026-11-25',
  start_at: '2026-11-25T03:00:00Z', end_at: '2026-11-26T03:00:00Z',
  filters: {}, warnings: [],
}

function prospectingPayload() {
  return {
    meta,
    cohort: { total: 0 },
    events: { contacts: 0, contactedLeads: 0, responses: 0, respondedLeads: 0, conversions: 0 },
    rates: {
      response: { numerator: 0, denominator: 0, value: null, sufficient: false },
      conversion: { numerator: 0, denominator: 0, value: null, sufficient: false },
    },
    series: [], byStatus: [], byNiche: [], byCity: [], byService: [], ranking: [],
  }
}

beforeEach(() => {
  rpc.mockReset()
})

describe('reportService', () => {
  it('resolve São Paulo e chama a RPC com fim exclusivo e filtros normalizados', async () => {
    rpc.mockResolvedValue({ data: prospectingPayload(), error: null })
    const result = await loadReportData('prospecting', {
      period: 'custom', startDate: '2026-11-25', endDate: '2026-11-25', city: ' São Paulo ',
    }, new Date('2026-11-26T12:00:00Z'))

    expect(rpc).toHaveBeenCalledWith('get_report_prospecting', {
      p_start: '2026-11-25T03:00:00.000Z', p_end: '2026-11-26T03:00:00.000Z',
      p_niche: null, p_city: 'São Paulo', p_status: null, p_service: null,
    })
    expect(result.meta).toMatchObject({
      startDate: '2026-11-25', endDate: '2026-11-25',
      filters: { period: 'custom', startDate: '2026-11-25', endDate: '2026-11-25', city: 'São Paulo' },
    })
  })

  it('rejeita payload malformado em vez de renderizar número vazio', async () => {
    rpc.mockResolvedValue({ data: { ...prospectingPayload(), cohort: {} }, error: null })
    await expect(loadReportData('prospecting', { period: 'today' })).rejects.toThrow(/coorte.total/)
  })

  it('rejeita taxa com valor diferente da contagem e amostra insuficiente incoerente', async () => {
    const malformed = {
      ...prospectingPayload(),
      rates: { ...prospectingPayload().rates, response: { numerator: 1, denominator: 4, value: 0.9, sufficient: false } },
    }
    rpc.mockResolvedValue({ data: malformed, error: null })
    await expect(loadReportData('prospecting', { period: 'today' })).rejects.toThrow(/Taxa divergente/)

    const badSample = {
      ...prospectingPayload(),
      rates: { ...prospectingPayload().rates, response: { numerator: 1, denominator: 5, value: 0.2, sufficient: false } },
    }
    rpc.mockResolvedValue({ data: badSample, error: null })
    await expect(loadReportData('prospecting', { period: 'today' })).rejects.toThrow(/Amostra inválida/)
  })

  it('carrega cidades e serviços reais', async () => {
    rpc.mockResolvedValue({ data: { cities: ['Santos', 'São Paulo'], services: ['Site'] }, error: null })
    await expect(getReportFilterOptions()).resolves.toEqual({
      cities: ['Santos', 'São Paulo'], services: ['Site'],
    })
  })

  it('pagina o export até o fim e só então monta o CSV', async () => {
    rpc
      .mockResolvedValueOnce({
        data: {
          rows: [{ id: 'a', name: 'Lead A', created_at: '2026-11-25T12:00:00Z' }],
          next_cursor: { scope: 's', occurredAt: '2026-11-25T12:00:00.000Z', id: 'a' },
          total: 2, generated_at: meta.generated_at,
        }, error: null,
      })
      .mockResolvedValueOnce({
        data: {
          rows: [{ id: 'b', name: '=1+1', created_at: '2026-11-26T12:00:00Z' }],
          next_cursor: null, total: 2, generated_at: meta.generated_at,
        }, error: null,
      })

    const result = await exportReport('leads', { period: 'custom', startDate: '2026-11-25', endDate: '2026-11-26' })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[1][1].p_cursor).toEqual({ scope: 's', occurredAt: '2026-11-25T12:00:00.000Z', id: 'a' })
    expect(result.total).toBe(2)
    expect(result.csv).toContain('Lead A')
    expect(result.csv).toContain("'=1+1")
  })

  it('rejeita término incompleto quando next_cursor é null mas o total não fecha', async () => {
    rpc.mockResolvedValue({
      data: { rows: [{ id: 'a' }], next_cursor: null, total: 2, generated_at: meta.generated_at },
      error: null,
    })
    await expect(exportReport('leads', { period: 'today' })).rejects.toThrow(/Exportação incompleta/)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('não retorna arquivo quando a segunda página falha', async () => {
    rpc
      .mockResolvedValueOnce({
        data: {
          rows: [{ id: 'a' }], next_cursor: { scope: 's', occurredAt: '2026-11-25T12:00:00.000Z', id: 'a' },
          total: 2, generated_at: meta.generated_at,
        }, error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'Falha de conexão com o Supabase.' } })
    await expect(exportReport('leads', { period: 'today' })).rejects.toThrow(/Falha de conexão/)
  })

  it('rejeita cursor repetido e acima do limite de segurança', async () => {
    const cursor = { scope: 's', occurredAt: '2026-11-25T12:00:00.000Z', id: 'a' }
    rpc.mockResolvedValue({
      data: { rows: [{ id: 'a' }], next_cursor: cursor, total: 2, generated_at: meta.generated_at },
      error: null,
    })
    await expect(exportReport('leads', { period: 'today' })).rejects.toThrow(/cursor repetido/i)

    rpc.mockResolvedValue({
      data: { rows: [], next_cursor: null, total: 10001, generated_at: meta.generated_at }, error: null,
    })
    await expect(exportReport('leads', { period: 'today' })).rejects.toThrow(/10\.000/)
  })
})
```

Comando: `npm test -- src/services/reportService.test.ts`
Falha esperada: `./reportService` ausente.

- [ ] **Step 3: Implementar parsers, RPCs e o loop de export**

Criar `src/services/reportService.ts`:

```ts
import { MAX_MONEY_CENTS } from '../lib/money'
import { requireSupabase, throwDbError } from '../lib/db'
import {
  buildReportCsv, normalizeReportFilters, reportExportFileName, resolveReportPeriod,
} from '../lib/reports'
import type {
  ClientsReport, ConsolidatedReport, FinancialReport, OpportunitiesReport, ProspectingReport,
  ProjectsReport, ReportData, ReportExportCursor, ReportExportFile,
  ReportExportModule, ReportExportPage, ReportExportRow, ReportFilterOptions, ReportFilters,
  ReportGroup, ReportMeta, ReportRate, ReportSeriesPoint, ReportView, ResolvedReportPeriod,
} from '../types/report'

type Json = Record<string, unknown>

function object(value: unknown, path: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Payload inválido em ${path}.`)
  return value as Json
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Payload inválido em ${path}.`)
  return value
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`Payload inválido em ${path}.`)
  return value
}

function nullableText(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null
  return text(value, path)
}

function integer(value: unknown, path: string): number {
  const parsed = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed)) throw new Error(`Inteiro inválido em ${path}.`)
  return parsed
}

function nonNegative(value: unknown, path: string): number {
  const parsed = integer(value, path)
  if (parsed < 0) throw new Error(`Valor negativo inválido em ${path}.`)
  return parsed
}

function cents(value: unknown, path: string): number {
  const parsed = integer(value, path)
  if (Math.abs(parsed) > MAX_MONEY_CENTS) throw new Error(`Centavos inseguros em ${path}.`)
  return parsed
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Booleano inválido em ${path}.`)
  return value
}

function nullableNumber(value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null
  return integer(value, path)
}

function nullableDecimal(value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) throw new Error(`Número inválido em ${path}.`)
  return parsed
}

function parseRate(value: unknown, path: string): ReportRate {
  const raw = object(value, path)
  const numerator = nonNegative(raw.numerator, `${path}.numerator`)
  const denominator = nonNegative(raw.denominator, `${path}.denominator`)
  const rate = nullableDecimal(raw.value, `${path}.value`)
  const sufficient = boolean(raw.sufficient, `${path}.sufficient`)
  if (sufficient !== (denominator >= 5)) throw new Error(`Amostra inválida em ${path}.sufficient.`)
  if (denominator === 0) {
    if (rate !== null) throw new Error(`Taxa sem denominador deve ser null em ${path}.value.`)
  } else if (rate === null || Math.abs(rate - numerator / denominator) > 1e-9) {
    throw new Error(`Taxa divergente do numerador/denominador em ${path}.value.`)
  }
  return { numerator, denominator, value: rate, sufficient }
}

function parseMeta(value: unknown, filters: ReportFilters, period: ResolvedReportPeriod): ReportMeta {
  const raw = object(value, 'meta')
  return {
    generatedAt: text(raw.generated_at, 'meta.generated_at'),
    startDate: period.startDate, endDate: period.endDate, startAt: period.startAt, endAt: period.endAt,
    filters,
    warnings: array(raw.warnings, 'meta.warnings').map((item, index) => text(item, `meta.warnings.${index}`)),
  }
}

function parseGroup(value: unknown, path: string): ReportGroup {
  const raw = object(value, path)
  return {
    key: text(raw.key, `${path}.key`), label: text(raw.label, `${path}.label`),
    count: nonNegative(raw.count, `${path}.count`),
    ...(raw.amountCents === undefined ? {} : { amountCents: cents(raw.amountCents, `${path}.amountCents`) }),
    ...(raw.rate === undefined ? {} : { rate: parseRate(raw.rate, `${path}.rate`) }),
    ...(raw.rank === undefined ? {} : { rank: nullableNumber(raw.rank, `${path}.rank`) }),
  }
}

function parseGroups(value: unknown, path: string): ReportGroup[] {
  return array(value, path).map((item, index) => parseGroup(item, `${path}.${index}`))
}

function parseSeries(value: unknown, path: string): ReportSeriesPoint[] {
  return array(value, path).map((item, index) => {
    const raw = object(item, `${path}.${index}`)
    return {
      bucket: text(raw.bucket, `${path}.${index}.bucket`), label: text(raw.label, `${path}.${index}.label`),
      count: nonNegative(raw.count, `${path}.${index}.count`),
      ...(raw.numerator === undefined ? {} : { numerator: nonNegative(raw.numerator, `${path}.${index}.numerator`) }),
      ...(raw.denominator === undefined ? {} : { denominator: nonNegative(raw.denominator, `${path}.${index}.denominator`) }),
      ...(raw.rate === undefined ? {} : { rate: parseRate(raw.rate, `${path}.${index}.rate`) }),
      ...(raw.amountCents === undefined ? {} : { amountCents: cents(raw.amountCents, `${path}.${index}.amountCents`) }),
    }
  })
}

function parseProspecting(raw: Json, meta: ReportMeta): ProspectingReport {
  const cohort = object(raw.cohort, 'cohort')
  const events = object(raw.events, 'events')
  const rates = object(raw.rates, 'rates')
  return {
    meta, cohort: { total: nonNegative(cohort.total, 'cohort.total') },
    events: {
      contacts: nonNegative(events.contacts, 'events.contacts'),
      contactedLeads: nonNegative(events.contactedLeads, 'events.contactedLeads'),
      responses: nonNegative(events.responses, 'events.responses'),
      respondedLeads: nonNegative(events.respondedLeads, 'events.respondedLeads'),
      conversions: nonNegative(events.conversions, 'events.conversions'),
    },
    rates: { response: parseRate(rates.response, 'rates.response'), conversion: parseRate(rates.conversion, 'rates.conversion') },
    series: parseSeries(raw.series, 'series'), byStatus: parseGroups(raw.byStatus, 'byStatus'),
    byNiche: parseGroups(raw.byNiche, 'byNiche'), byCity: parseGroups(raw.byCity, 'byCity'),
    byService: parseGroups(raw.byService, 'byService'), ranking: parseGroups(raw.ranking, 'ranking'),
  }
}

function parseOpportunities(raw: Json, meta: ReportMeta): OpportunitiesReport {
  return {
    meta,
    totalLeads: nonNegative(raw.totalLeads, 'totalLeads'), qualified: nonNegative(raw.qualified, 'qualified'),
    notProspected: nonNegative(raw.notProspected, 'notProspected'),
    instagramWithoutSiteConfirmed: nonNegative(raw.instagramWithoutSiteConfirmed, 'instagramWithoutSiteConfirmed'),
    instagramWithoutSiteUnverified: nonNegative(raw.instagramWithoutSiteUnverified, 'instagramWithoutSiteUnverified'),
    estimatedCents: cents(raw.estimatedCents, 'estimatedCents'), negotiatedCents: cents(raw.negotiatedCents, 'negotiatedCents'),
    contractedSnapshotCents: cents(raw.contractedSnapshotCents, 'contractedSnapshotCents'),
    receivedLedgerCents: cents(raw.receivedLedgerCents, 'receivedLedgerCents'),
    conversionRate: parseRate(raw.conversionRate, 'conversionRate'),
    byNiche: parseGroups(raw.byNiche, 'byNiche'), byNeed: parseGroups(raw.byNeed, 'byNeed'),
    byPriority: parseGroups(raw.byPriority, 'byPriority'), byCity: parseGroups(raw.byCity, 'byCity'),
    byState: parseGroups(raw.byState, 'byState'), byService: parseGroups(raw.byService, 'byService'),
    ranking: parseGroups(raw.ranking, 'ranking'),
  }
}

function parseClients(raw: Json, meta: ReportMeta): ClientsReport {
  return {
    meta,
    total: nonNegative(raw.total, 'total'), active: nonNegative(raw.active, 'active'),
    inactive: nonNegative(raw.inactive, 'inactive'), inProject: nonNegative(raw.inProject, 'inProject'),
    pendingPayment: nonNegative(raw.pendingPayment, 'pendingPayment'), pendingCents: cents(raw.pendingCents, 'pendingCents'),
    newInPeriod: nonNegative(raw.newInPeriod, 'newInPeriod'),
    conversionsInPeriod: nonNegative(raw.conversionsInPeriod, 'conversionsInPeriod'),
    series: parseSeries(raw.series, 'series'), byStatus: parseGroups(raw.byStatus, 'byStatus'),
    byNiche: parseGroups(raw.byNiche, 'byNiche'), byCity: parseGroups(raw.byCity, 'byCity'),
    byService: parseGroups(raw.byService, 'byService'),
    history: array(raw.history, 'history').map((item, index) => {
      const entry = object(item, `history.${index}`)
      const source = text(entry.source, `history.${index}.source`)
      if (source !== 'client' && source !== 'lead' && source !== 'contract') throw new Error(`Fonte inválida em history.${index}.`)
      return {
        id: text(entry.id, `history.${index}.id`), clientId: text(entry.client_id, `history.${index}.client_id`),
        clientName: text(entry.client_name, `history.${index}.client_name`), type: text(entry.type, `history.${index}.type`),
        description: text(entry.description, `history.${index}.description`),
        createdAt: text(entry.created_at, `history.${index}.created_at`), source,
      }
    }),
    historyTruncated: boolean(raw.historyTruncated, 'historyTruncated'),
  }
}

function parseProjects(raw: Json, meta: ReportMeta): ProjectsReport {
  const attention = object(raw.attention, 'attention')
  return {
    meta, total: nonNegative(raw.total, 'total'), delayed: nonNegative(raw.delayed, 'delayed'),
    averageDurationDays: nullableDecimal(raw.averageDurationDays, 'averageDurationDays'),
    completionRate: parseRate(raw.completionRate, 'completionRate'), byStatus: parseGroups(raw.byStatus, 'byStatus'),
    productivity: parseSeries(raw.productivity, 'productivity'),
    attention: {
      total: nonNegative(attention.total, 'attention.total'), delayed: nonNegative(attention.delayed, 'attention.delayed'),
      pendingReview: nonNegative(attention.pendingReview, 'attention.pendingReview'),
      pendingApproval: nonNegative(attention.pendingApproval, 'attention.pendingApproval'),
      overdueTasks: nonNegative(attention.overdueTasks, 'attention.overdueTasks'),
      items: array(attention.items, 'attention.items').map((item, index) => {
        const entry = object(item, `attention.items.${index}`)
        return {
          projectId: text(entry.projectId, `attention.items.${index}.projectId`),
          projectName: text(entry.projectName, `attention.items.${index}.projectName`),
          clientName: text(entry.clientName, `attention.items.${index}.clientName`),
          service: text(entry.service, `attention.items.${index}.service`), status: text(entry.status, `attention.items.${index}.status`),
          dueDate: nullableText(entry.dueDate, `attention.items.${index}.dueDate`),
          reasons: array(entry.reasons, `attention.items.${index}.reasons`).map((reason) => text(reason, 'attention.reason')),
        }
      }),
      truncated: boolean(attention.truncated, 'attention.truncated'),
    },
  }
}

function parseFinancial(raw: Json, meta: ReportMeta): FinancialReport {
  const receivable = (value: unknown, path: string) => {
    const entry = object(value, path)
    return {
      contractId: text(entry.contractId, `${path}.contractId`), clientName: text(entry.clientName, `${path}.clientName`),
      service: text(entry.service, `${path}.service`), dueDate: text(entry.dueDate, `${path}.dueDate`),
      remainingCents: cents(entry.remainingCents, `${path}.remainingCents`),
    }
  }
  return {
    meta,
    contractedActiveCents: cents(raw.contractedActiveCents, 'contractedActiveCents'),
    receivedHistoricalCents: cents(raw.receivedHistoricalCents, 'receivedHistoricalCents'),
    pendingCents: cents(raw.pendingCents, 'pendingCents'), periodReceiptsCents: cents(raw.periodReceiptsCents, 'periodReceiptsCents'),
    periodRefundsCents: cents(raw.periodRefundsCents, 'periodRefundsCents'),
    periodNetReceiptsCents: cents(raw.periodNetReceiptsCents, 'periodNetReceiptsCents'),
    periodPaidExpensesCents: cents(raw.periodPaidExpensesCents, 'periodPaidExpensesCents'),
    pendingExpensesCents: cents(raw.pendingExpensesCents, 'pendingExpensesCents'),
    periodProfitCents: cents(raw.periodProfitCents, 'periodProfitCents'), overdueCents: cents(raw.overdueCents, 'overdueCents'),
    overdueExpensesCents: cents(raw.overdueExpensesCents, 'overdueExpensesCents'),
    cashFlow: array(raw.cashFlow, 'cashFlow').map((item, index) => {
      const entry = object(item, `cashFlow.${index}`)
      return {
        label: text(entry.label, `cashFlow.${index}.label`), receiptsCents: cents(entry.receiptsCents, `cashFlow.${index}.receiptsCents`),
        expensesCents: cents(entry.expensesCents, `cashFlow.${index}.expensesCents`), netCents: cents(entry.netCents, `cashFlow.${index}.netCents`),
        balanceCents: cents(entry.balanceCents, `cashFlow.${index}.balanceCents`),
      }
    }),
    categories: array(raw.categories, 'categories').map((item, index) => {
      const entry = object(item, `categories.${index}`)
      return { categoryId: nullableText(entry.categoryId, `categories.${index}.categoryId`), name: text(entry.name, `categories.${index}.name`), amountCents: cents(entry.amountCents, `categories.${index}.amountCents`) }
    }),
    paymentMethods: array(raw.paymentMethods, 'paymentMethods').map((item, index) => {
      const entry = object(item, `paymentMethods.${index}`)
      return { method: text(entry.method, `paymentMethods.${index}.method`), receiptsCents: cents(entry.receiptsCents, `paymentMethods.${index}.receiptsCents`), refundsCents: cents(entry.refundsCents, `paymentMethods.${index}.refundsCents`) }
    }),
    overdue: array(raw.overdue, 'overdue').map((item, index) => receivable(item, `overdue.${index}`)),
    upcoming: array(raw.upcoming, 'upcoming').map((item, index) => receivable(item, `upcoming.${index}`)),
    listsTruncated: boolean(raw.listsTruncated, 'listsTruncated'),
  }
}

function parseCross(value: unknown, path: string) {
  const raw = object(value, path)
  return {
    bucket: text(raw.bucket, `${path}.bucket`), niche: text(raw.niche, `${path}.niche`),
    city: text(raw.city, `${path}.city`), service: text(raw.service, `${path}.service`),
    leads: nonNegative(raw.leads, `${path}.leads`), clients: nonNegative(raw.clients, `${path}.clients`),
    projects: nonNegative(raw.projects, `${path}.projects`), movements: nonNegative(raw.movements, `${path}.movements`),
    receiptsCents: cents(raw.receiptsCents, `${path}.receiptsCents`), refundsCents: cents(raw.refundsCents, `${path}.refundsCents`),
    paidExpensesCents: cents(raw.paidExpensesCents, `${path}.paidExpensesCents`),
    leadEstimatedCents: cents(raw.leadEstimatedCents, `${path}.leadEstimatedCents`),
    leadNegotiatedCents: cents(raw.leadNegotiatedCents, `${path}.leadNegotiatedCents`),
    leadContractedSnapshotCents: cents(raw.leadContractedSnapshotCents, `${path}.leadContractedSnapshotCents`),
    contractContractedCents: cents(raw.contractContractedCents, `${path}.contractContractedCents`),
    projectContractedCents: cents(raw.projectContractedCents, `${path}.projectContractedCents`),
  }
}

function parseConsolidated(raw: Json, meta: ReportMeta): ConsolidatedReport {
  const totals = object(raw.totals, 'totals')
  return {
    meta,
    totals: {
      leads: nonNegative(totals.leads, 'totals.leads'), clients: nonNegative(totals.clients, 'totals.clients'),
      projects: nonNegative(totals.projects, 'totals.projects'), movements: nonNegative(totals.movements, 'totals.movements'),
      receiptsCents: cents(totals.receiptsCents, 'totals.receiptsCents'), refundsCents: cents(totals.refundsCents, 'totals.refundsCents'),
      paidExpensesCents: cents(totals.paidExpensesCents, 'totals.paidExpensesCents'), netCents: cents(totals.netCents, 'totals.netCents'),
      leadEstimatedCents: cents(totals.leadEstimatedCents, 'totals.leadEstimatedCents'),
      leadNegotiatedCents: cents(totals.leadNegotiatedCents, 'totals.leadNegotiatedCents'),
      leadContractedSnapshotCents: cents(totals.leadContractedSnapshotCents, 'totals.leadContractedSnapshotCents'),
      contractContractedCents: cents(totals.contractContractedCents, 'totals.contractContractedCents'),
      projectContractedCents: cents(totals.projectContractedCents, 'totals.projectContractedCents'),
    },
    byPeriod: array(raw.byPeriod, 'byPeriod').map((item, index) => parseCross(item, `byPeriod.${index}`)),
    byNiche: array(raw.byNiche, 'byNiche').map((item, index) => parseCross(item, `byNiche.${index}`)),
    byCity: array(raw.byCity, 'byCity').map((item, index) => parseCross(item, `byCity.${index}`)),
    byService: array(raw.byService, 'byService').map((item, index) => parseCross(item, `byService.${index}`)),
    crossBuckets: array(raw.crossBuckets, 'crossBuckets').map((item, index) => parseCross(item, `crossBuckets.${index}`)),
    crossBucketsTruncated: boolean(raw.crossBucketsTruncated, 'crossBucketsTruncated'),
    groupsTruncated: boolean(raw.groupsTruncated, 'groupsTruncated'),
  }
}

export function parseReportData(view: ReportView, payload: unknown, filters: ReportFilters, period: ResolvedReportPeriod): ReportData {
  const raw = object(payload, 'report')
  const meta = parseMeta(raw.meta, filters, period)
  switch (view) {
    case 'prospecting': return parseProspecting(raw, meta)
    case 'opportunities': return parseOpportunities(raw, meta)
    case 'clients': return parseClients(raw, meta)
    case 'projects': return parseProjects(raw, meta)
    case 'financial': return parseFinancial(raw, meta)
    case 'consolidated': return parseConsolidated(raw, meta)
  }
}

const REPORT_RPC: Record<ReportView, string> = {
  prospecting: 'get_report_prospecting', opportunities: 'get_report_opportunities', clients: 'get_report_clients',
  projects: 'get_report_projects', financial: 'get_report_financial', consolidated: 'get_report_consolidated',
}

async function callRpc(name: string, params: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await requireSupabase().rpc(name, params)
  if (error) {
    if (/10\.000|cursor|limite da página/i.test(error.message)) throw new Error(error.message)
    throwDbError(error)
  }
  return data
}

export async function loadReportData(view: ReportView, input: ReportFilters, now = new Date()): Promise<ReportData> {
  const filters = normalizeReportFilters(view, input)
  const period = resolveReportPeriod(filters, now)
  const payload = await callRpc(REPORT_RPC[view], {
    p_start: period.startAt, p_end: period.endAt, p_niche: filters.niche ?? null,
    p_city: filters.city ?? null, p_status: filters.status ?? null, p_service: filters.service ?? null,
  })
  return parseReportData(view, payload, filters, period)
}

export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  const payload = object(await callRpc('get_report_filter_options', {}), 'filter_options')
  return {
    cities: array(payload.cities, 'cities').map((item) => text(item, 'city')),
    services: array(payload.services, 'services').map((item) => text(item, 'service')),
  }
}

function parseCursor(value: unknown, module: ReportExportModule): ReportExportCursor {
  const raw = object(value, 'cursor')
  const scope = text(raw.scope, 'cursor.scope')
  if (module === 'consolidated') {
    return { scope, bucket: text(raw.bucket, 'cursor.bucket'), niche: text(raw.niche, 'cursor.niche'), city: text(raw.city, 'cursor.city'), service: text(raw.service, 'cursor.service') }
  }
  return { scope, occurredAt: text(raw.occurredAt, 'cursor.occurredAt'), id: text(raw.id, 'cursor.id') }
}

function parseExportPage(value: unknown, module: ReportExportModule): ReportExportPage {
  const raw = object(value, 'export')
  const rows = array(raw.rows, 'export.rows').map((item, index): ReportExportRow => {
    const row = object(item, `export.rows.${index}`)
    const result: ReportExportRow = {}
    for (const [key, cell] of Object.entries(row)) {
      if (cell === null || typeof cell === 'string') result[key] = cell
      else if (typeof cell === 'number' && Number.isSafeInteger(cell)) result[key] = cell
      else throw new Error(`Célula inválida em export.rows.${index}.${key}.`)
    }
    return result
  })
  return {
    rows, total: nonNegative(raw.total, 'export.total'), generatedAt: text(raw.generated_at, 'export.generated_at'),
    nextCursor: raw.next_cursor === null ? null : parseCursor(raw.next_cursor, module),
  }
}

export async function exportReport(
  module: ReportExportModule,
  input: ReportFilters,
  onProgress?: (loaded: number, total: number) => void,
  now = new Date(),
): Promise<ReportExportFile> {
  const view: ReportView = module === 'leads' ? 'prospecting'
    : module === 'receipts' || module === 'expenses' ? 'financial'
      : module
  const filters = normalizeReportFilters(view, input)
  const period = resolveReportPeriod(filters, now)
  const rows: ReportExportRow[] = []
  const seenCursors = new Set<string>()
  let cursor: ReportExportCursor | null = null
  let total = 0

  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const payload = await callRpc('get_report_export', {
      p_module: module, p_start: period.startAt, p_end: period.endAt,
      p_niche: filters.niche ?? null, p_city: filters.city ?? null, p_status: filters.status ?? null,
      p_service: filters.service ?? null, p_cursor: cursor, p_limit: 1000,
    })
    const page = parseExportPage(payload, module)
    if (page.total > 10_000) throw new Error('A exportação excede o limite de 10.000 registros.')
    total = page.total
    rows.push(...page.rows)
    if (rows.length > 10_000) throw new Error('A exportação excede o limite de 10.000 registros.')
    onProgress?.(rows.length, total)
    if (page.nextCursor === null) {
      if (rows.length !== total) {
        throw new Error('Exportação incompleta: o total não corresponde às linhas recebidas.')
      }
      return {
        csv: buildReportCsv(module, rows),
        fileName: reportExportFileName(module, period.startDate, period.endDate),
        total,
      }
    }
    const key = JSON.stringify(page.nextCursor)
    if (seenCursors.has(key)) throw new Error('Cursor repetido durante a exportação.')
    seenCursors.add(key)
    cursor = page.nextCursor
  }
  throw new Error('A exportação excedeu 10 páginas sem concluir.')
}
```

- [ ] **Step 4: Inserir `get_report_filter_options` antes de `commit;`**

```sql
create or replace function public.get_report_filter_options()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.report_require_session();
  return jsonb_build_object(
    'cities', coalesce((
      select jsonb_agg(city order by city) from (
        select nullif(pg_catalog.btrim(city), '') as city from public.leads where city is not null
        union
        select nullif(pg_catalog.btrim(city), '') from public.clients where city is not null
      ) cities where city is not null
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(service order by service) from (
        select nullif(pg_catalog.btrim(offered_service), '') as service from public.leads where offered_service is not null
        union
        select nullif(pg_catalog.btrim(service), '') from public.contracts where service is not null
        union
        select nullif(pg_catalog.btrim(service), '') from public.projects where service is not null
      ) services where service is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_report_filter_options() from public, anon, authenticated;
grant execute on function public.get_report_filter_options() to authenticated;
```

- [ ] **Step 5: Executar testes GREEN e commitar**

Comandos:

```bash
npm test -- src/services/reportService.test.ts src/lib/reports.test.ts
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: parsers, chamadas, opções reais, paginação, falha sem parcial, cursor repetido e limite de segurança passando.

```bash
git add src/services/reportService.ts src/services/reportService.test.ts \
  supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql
git commit -m "feat: integrar relatórios ao Supabase"
```

---

### Task 9: Implementar o hook de snapshot atômico e descarte de respostas obsoletas

**Arquivos:**
- Criar: `src/hooks/useReportData.ts`
- Criar: `src/hooks/useReportData.test.tsx`

**Interfaces:**
- Consome `loadReportData` e `normalizeReportFilters`.
- Produz `useReportData(view, filters)` com `{ data, loading, error, reload }`.
- O snapshot carrega `view`, chave dos filtros normalizados e `ReportData` no mesmo estado; erro também é escopado. Trocar de escopo limpa o snapshot anterior, enquanto falhar ao atualizar o mesmo escopo preserva o último dado válido.

- [ ] **Step 1: Escrever os testes RED de concorrência, retry e unmount**

Criar `src/hooks/useReportData.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProspectingReport, ReportData, ReportFilters, ReportView } from '../types/report'
import { useReportData } from './useReportData'

const { loadReportData, stateUpdates } = vi.hoisted(() => ({
  loadReportData: vi.fn(),
  stateUpdates: vi.fn(),
}))

vi.mock('../services/reportService', () => ({ loadReportData }))

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

const baseFilters: ReportFilters = {
  period: 'custom', startDate: '2026-11-20', endDate: '2026-11-26', city: 'São Paulo',
}

function report(total: number, filters: ReportFilters = baseFilters): ProspectingReport {
  return {
    meta: {
      generatedAt: '2026-11-26T12:00:00Z', startDate: '2026-11-20', endDate: '2026-11-26',
      startAt: '2026-11-20T03:00:00Z', endAt: '2026-11-27T03:00:00Z', filters, warnings: [],
    },
    cohort: { total },
    events: { contacts: 0, contactedLeads: 0, responses: 0, respondedLeads: 0, conversions: 0 },
    rates: {
      response: { numerator: 0, denominator: 0, value: null, sufficient: false },
      conversion: { numerator: 0, denominator: 0, value: null, sufficient: false },
    },
    series: [], byStatus: [], byNiche: [], byCity: [], byService: [], ranking: [],
  }
}

function cohortTotal(data: ReportData | null): number | null {
  return data && 'cohort' in data ? data.cohort.total : null
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  loadReportData.mockReset()
  stateUpdates.mockClear()
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

describe('useReportData', () => {
  it('publica loading e depois um snapshot completo do escopo', async () => {
    loadReportData.mockResolvedValue(report(7))
    const { result } = renderHook(() => useReportData('prospecting', baseFilters))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(cohortTotal(result.current.data)).toBe(7)
    expect(result.current.error).toBeNull()
    expect(loadReportData).toHaveBeenCalledWith('prospecting', baseFilters)
  })

  it('descarta a resposta antiga quando a nova responde primeiro', async () => {
    const first = deferred<ReportData>()
    const second = deferred<ReportData>()
    loadReportData.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(
      ({ filters }) => useReportData('prospecting', filters),
      { initialProps: { filters: baseFilters } },
    )
    const nextFilters = { ...baseFilters, city: 'Campinas' }
    rerender({ filters: nextFilters })

    await act(async () => { second.resolve(report(2, nextFilters)) })
    await waitFor(() => expect(cohortTotal(result.current.data)).toBe(2))
    await act(async () => { first.resolve(report(99)) })

    expect(cohortTotal(result.current.data)).toBe(2)
    expect(result.current.data?.meta.filters.city).toBe('Campinas')
    expect(result.current.error).toBeNull()
  })

  it('publica loading do novo filtro antes do efeito, sem flash de estado vazio concluído', async () => {
    loadReportData.mockResolvedValue(report(7))
    const { result, rerender } = renderHook(
      ({ filters }) => useReportData('prospecting', filters),
      { initialProps: { filters: baseFilters } },
    )
    await waitFor(() => expect(cohortTotal(result.current.data)).toBe(7))

    loadReportData.mockReturnValue(new Promise<ReportData>(() => {}))
    rerender({ filters: { ...baseFilters, city: 'Campinas' } })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('limpa o snapshot ao trocar de escopo e não mistura visões', async () => {
    loadReportData.mockResolvedValue(report(7))
    const { result, rerender } = renderHook(
      ({ view, filters }) => useReportData(view, filters),
      { initialProps: { view: 'prospecting', filters: baseFilters } as {
        view: ReportView
        filters: ReportFilters
      } },
    )
    await waitFor(() => expect(cohortTotal(result.current.data)).toBe(7))

    loadReportData.mockReturnValue(new Promise<ReportData>(() => {}))
    rerender({ view: 'financial', filters: { period: 'today' } })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('preserva o último snapshot quando a atualização do mesmo escopo falha', async () => {
    loadReportData.mockResolvedValueOnce(report(7)).mockRejectedValueOnce(new Error('Falha temporária.'))
    const { result } = renderHook(() => useReportData('prospecting', baseFilters))
    await waitFor(() => expect(cohortTotal(result.current.data)).toBe(7))

    act(() => { result.current.reload() })
    await waitFor(() => expect(result.current.error).toBe('Falha temporária.'))
    expect(cohortTotal(result.current.data)).toBe(7)
    expect(result.current.loading).toBe(false)

    loadReportData.mockResolvedValueOnce(report(8))
    act(() => { result.current.reload() })
    await waitFor(() => expect(cohortTotal(result.current.data)).toBe(8))
    expect(result.current.error).toBeNull()
  })

  it('não atualiza estado depois do unmount', async () => {
    const request = deferred<ReportData>()
    loadReportData.mockReturnValue(request.promise)
    const { unmount } = renderHook(() => useReportData('prospecting', baseFilters))
    unmount()
    stateUpdates.mockClear()

    await act(async () => { request.resolve(report(7)) })
    expect(stateUpdates).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('traduz rejeição que não é Error para mensagem explícita', async () => {
    loadReportData.mockRejectedValue('boom')
    const { result } = renderHook(() => useReportData('prospecting', baseFilters))
    await waitFor(() => expect(result.current.error).toBe('Erro ao carregar relatório.'))
    expect(result.current.data).toBeNull()
  })
})
```

Comando: `npm test -- src/hooks/useReportData.test.tsx`
Falha esperada: `./useReportData` ausente.

- [ ] **Step 2: Implementar o hook literal**

Criar `src/hooks/useReportData.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeReportFilters } from '../lib/reports'
import { loadReportData } from '../services/reportService'
import type { ReportData, ReportFilters, ReportView } from '../types/report'

interface ReportSnapshot {
  view: ReportView
  scopeKey: string
  data: ReportData
}

interface ScopedError {
  view: ReportView
  scopeKey: string
  message: string
}

interface ScopedLoading {
  view: ReportView
  scopeKey: string
  value: boolean
}

export interface UseReportDataResult {
  data: ReportData | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useReportData(view: ReportView, input: ReportFilters): UseReportDataResult {
  const filters = useMemo(() => normalizeReportFilters(view, input), [view, input])
  const scopeKey = JSON.stringify(filters)
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null)
  const snapshotRef = useRef<ReportSnapshot | null>(null)
  const [scopedError, setScopedError] = useState<ScopedError | null>(null)
  const [loadingState, setLoadingState] = useState<ScopedLoading>({ view, scopeKey, value: true })
  const [reloadToken, setReloadToken] = useState(0)
  const requestVersion = useRef(0)
  const activeRef = useRef(false)

  useEffect(() => {
    const version = requestVersion.current + 1
    requestVersion.current = version
    activeRef.current = true
    const current = snapshotRef.current
    if (!current || current.view !== view || current.scopeKey !== scopeKey) {
      snapshotRef.current = null
      setSnapshot(null)
      setScopedError(null)
    }
    setLoadingState({ view, scopeKey, value: true })

    void loadReportData(view, filters).then(
      (data) => {
        if (!activeRef.current || requestVersion.current !== version) return
        const next = { view, scopeKey, data }
        snapshotRef.current = next
        setSnapshot(next)
        setScopedError(null)
        setLoadingState({ view, scopeKey, value: false })
      },
      (cause: unknown) => {
        if (!activeRef.current || requestVersion.current !== version) return
        setScopedError({
          view, scopeKey,
          message: cause instanceof Error ? cause.message : 'Erro ao carregar relatório.',
        })
        setLoadingState({ view, scopeKey, value: false })
      },
    )

    return () => { activeRef.current = false }
  }, [view, filters, scopeKey, reloadToken])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const matchesScope = snapshot?.view === view && snapshot.scopeKey === scopeKey
  const error = scopedError && scopedError.view === view && scopedError.scopeKey === scopeKey
    ? scopedError.message
    : null
  const loading = loadingState.view === view && loadingState.scopeKey === scopeKey
    ? loadingState.value
    : true
  return { data: snapshot && matchesScope ? snapshot.data : null, loading, error, reload }
}
```

- [ ] **Step 3: Executar o teste GREEN e revisar**

Comando: `npm test -- src/hooks/useReportData.test.tsx`
Resultado esperado: carga inicial, corrida entre requisições, troca de escopo, preservação em erro, retry, unmount e rejeição genérica passando sem aviso de console.

Comando de revisão: `git diff --check`.

- [ ] **Step 4: Criar commit**

```bash
git add src/hooks/useReportData.ts src/hooks/useReportData.test.tsx
git commit -m "feat: estabilizar snapshots das consultas de relatórios"
```

---

### Task 10: Implementar filtros, indicadores, estados, exportação e gráficos lazy

**Arquivos:**
- Criar: `src/components/reports/ReportFiltersBar.tsx`
- Criar: `src/components/reports/ReportMetric.tsx`
- Criar: `src/components/reports/ReportExportButton.tsx`
- Criar: `src/components/reports/ReportsPageStates.tsx`
- Criar: `src/components/reports/ReportCharts.tsx`
- Criar: `src/components/reports/ReportComponents.test.tsx`

**Interfaces:**
- `ReportFiltersBar` recebe `view`, `filters`, `options` e `onChange`; nichos vêm de `NICHES`, cidades/serviços vêm da RPC e status inaplicável fica desabilitado.
- `ReportMetric` formata valores já calculados; `ReportRateMetric` só exibe percentual com denominador mínimo de cinco, caso contrário exibe contagem e “Dados insuficientes para conclusão”.
- `ReportExportButton` escolhe módulos compatíveis com a visão, mostra progresso por página e cria o download somente quando `exportReport` retorna o arquivo completo.
- `ReportCharts` é o único módulo de Relatórios que importa Recharts; será importado com `lazy` na Task 11.
- Tabelas e gráficos traduzem códigos canônicos de nicho, status, necessidade e prioridade com os mapas pt-BR; os CSVs preservam os códigos para manter o backup relacional.

- [ ] **Step 1: Escrever os testes RED dos controles e do download**

Criar `src/components/reports/ReportComponents.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportExportButton } from './ReportExportButton'
import { ReportFiltersBar } from './ReportFiltersBar'
import { ReportMetric, ReportRateMetric } from './ReportMetric'
import { ReportEmpty, ReportError, ReportLoading } from './ReportsPageStates'

const { exportReport } = vi.hoisted(() => ({ exportReport: vi.fn() }))
vi.mock('../../services/reportService', () => ({ exportReport }))

const createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let anchorClick: ReturnType<typeof vi.spyOn>
let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  exportReport.mockReset()
  createObjectURL = vi.fn(() => 'blob:relatorio')
  revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  consoleError = vi.spyOn(console, 'error')
  consoleWarn = vi.spyOn(console, 'warn')
})

afterEach(() => {
  cleanup()
  expect(consoleError).not.toHaveBeenCalled()
  expect(consoleWarn).not.toHaveBeenCalled()
  consoleError.mockRestore()
  consoleWarn.mockRestore()
  anchorClick.mockRestore()
  if (createUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createUrlDescriptor)
  else Reflect.deleteProperty(URL, 'createObjectURL')
  if (revokeUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeUrlDescriptor)
  else Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('controles de relatórios', () => {
  it('desabilita status inaplicável e usa opções reais de cidade e serviço', () => {
    const onChange = vi.fn()
    render(
      <ReportFiltersBar
        view="financial"
        filters={{ period: 'today', status: 'active' }}
        options={{ cities: ['Santos'], services: ['Consultoria'] }}
        onChange={onChange}
      />,
    )

    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('')
    expect(screen.getByRole('option', { name: 'Santos' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Consultoria' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Santos' } })
    expect(onChange).toHaveBeenCalledWith({ period: 'today', status: 'active', city: 'Santos' })
  })

  it('mostra datas inicial e final somente no período personalizado', () => {
    const { rerender } = render(
      <ReportFiltersBar
        view="clients"
        filters={{ period: 'custom', startDate: '2026-11-20', endDate: '2026-11-26' }}
        options={{ cities: [], services: [] }}
        onChange={vi.fn()}
      />,
    )
    expect((screen.getByLabelText('Data inicial') as HTMLInputElement).value).toBe('2026-11-20')
    expect((screen.getByLabelText('Data final') as HTMLInputElement).value).toBe('2026-11-26')

    rerender(
      <ReportFiltersBar
        view="clients"
        filters={{ period: 'today' }}
        options={{ cities: [], services: [] }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Data inicial')).toBeNull()
    expect(screen.queryByLabelText('Data final')).toBeNull()
  })

  it('exibe rótulos pt-BR de nicho e status sem exibir códigos crus', () => {
    const { rerender } = render(
      <ReportFiltersBar view="prospecting" filters={{ period: 'today' }} options={{ cities: [], services: [] }} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('option', { name: 'Barbearia' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Contato realizado' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'barbearia' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'contato_realizado' })).toBeNull()

    rerender(<ReportFiltersBar view="projects" filters={{ period: 'today' }} options={{ cities: [], services: [] }} onChange={vi.fn()} />)
    expect(screen.getByRole('option', { name: 'Em desenvolvimento' })).toBeTruthy()
  })

  it('não conclui percentual sem amostra mínima e mantém a contagem', () => {
    const { rerender } = render(
      <ReportRateMetric label="Conversão" rate={{ numerator: 1, denominator: 4, value: 0.25, sufficient: false }} />,
    )
    expect(screen.getByText('Dados insuficientes para conclusão')).toBeTruthy()
    expect(screen.getByText('1 de 4 registros')).toBeTruthy()
    expect(screen.queryByText('25%')).toBeNull()

    rerender(<ReportRateMetric label="Conversão" rate={{ numerator: 1, denominator: 5, value: 0.2, sufficient: true }} />)
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.queryByText('Dados insuficientes para conclusão')).toBeNull()

    rerender(<ReportRateMetric label="Conversão" rate={{ numerator: 0, denominator: 0, value: null, sufficient: false }} />)
    expect(screen.getByText('Sem base de cálculo')).toBeTruthy()
  })

  it('renderiza loading, vazio e erro com retry', () => {
    const onRetry = vi.fn()
    const { rerender } = render(<ReportLoading />)
    expect(screen.getByRole('status').textContent).toContain('Carregando relatório')

    rerender(<ReportEmpty title="Nenhum lead no período" description="Ajuste os filtros." />)
    expect(screen.getByRole('heading', { name: 'Nenhum lead no período' })).toBeTruthy()

    rerender(<ReportError message="Falha ao consultar." onRetry={onRetry} />)
    expect(screen.getByRole('alert').textContent).toContain('Falha ao consultar')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('mantém unidade monetária em centavos sem conversão flutuante', () => {
    render(<ReportMetric label="Recebido" value="R$ 1.234,56" hint="Ledger financeiro" />)
    expect(screen.getByRole('group', { name: 'Recebido' }).textContent).toContain('R$ 1.234,56')
    expect(screen.getByText('Ledger financeiro')).toBeTruthy()
  })
})

describe('ReportExportButton', () => {
  it('oferece recebimentos e despesas no Financeiro e só baixa ao concluir', async () => {
    exportReport.mockImplementation((_module, _filters, onProgress) => {
      onProgress(1000, 2000)
      return Promise.resolve({
        csv: '\uFEFFNome;Valor\r\nLead;1,00\r\n',
        fileName: 'ber-relatorio-receipts-2026-11-20-a-2026-11-26.csv', total: 1,
      })
    })
    render(<ReportExportButton view="financial" filters={{ period: 'today' }} />)

    expect(screen.getByRole('option', { name: 'Recebimentos e estornos' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Despesas' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1))
    expect(exportReport).toHaveBeenCalledWith('receipts', { period: 'today' }, expect.any(Function))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:relatorio')
    expect(screen.getByRole('status').textContent).toContain('1 registro')
  })

  it('descarta a exportação anterior quando qualquer filtro muda', async () => {
    let resolve!: (file: { csv: string; fileName: string; total: number }) => void
    exportReport.mockReturnValue(new Promise((done) => { resolve = done }))
    const { rerender } = render(<ReportExportButton view="prospecting" filters={{ period: 'today' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    rerender(<ReportExportButton view="prospecting" filters={{ period: 'today', city: 'Santos' }} />)
    await act(async () => {
      resolve({ csv: 'conteudo', fileName: 'relatorio-antigo.csv', total: 1 })
    })

    expect(anchorClick).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.queryByText(/Download de/)).toBeNull()
    expect((screen.getByRole('button', { name: 'Exportar CSV' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('não cria Blob nem baixa parcial quando a exportação falha', async () => {
    exportReport.mockRejectedValue(new Error('Falha na segunda página.'))
    render(<ReportExportButton view="consolidated" filters={{ period: 'today' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Falha na segunda página'))
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(anchorClick).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Exportar CSV' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
```

Comando: `npm test -- src/components/reports/ReportComponents.test.tsx`
Falha esperada: módulos de componentes ausentes.

- [ ] **Step 2: Implementar filtros, indicadores, estados e exportação**

Criar `src/components/reports/ReportFiltersBar.tsx`:

```tsx
import type { ReportFilters, ReportPeriod, ReportView } from '../../types/report'
import { reportNicheLabel, reportNiches, reportStatusLabel, reportStatusOptions } from '../../types/report'
import { Card } from '../ui/Card'

const PERIODS: Array<[ReportPeriod, string]> = [
  ['today', 'Hoje'], ['last_7_days', 'Últimos 7 dias'], ['last_30_days', 'Últimos 30 dias'],
  ['this_month', 'Este mês'], ['previous_month', 'Mês anterior'], ['last_3_months', 'Últimos 3 meses'],
  ['last_6_months', 'Últimos 6 meses'], ['this_year', 'Este ano'], ['previous_year', 'Ano anterior'],
  ['custom', 'Personalizado'],
]

interface ReportFiltersBarProps {
  view: ReportView
  filters: ReportFilters
  options: { cities: string[]; services: string[] }
  onChange: (filters: ReportFilters) => void
}

export function ReportFiltersBar({ view, filters, options, onChange }: ReportFiltersBarProps) {
  const statuses = reportStatusOptions(view)
  const change = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch })
  return (
    <Card title="Filtros do relatório">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-muted">
          Período
          <select className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
            value={filters.period} onChange={(event) => change({ period: event.target.value as ReportPeriod })}>
            {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">
          Nicho
          <select className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
            value={filters.niche ?? ''} onChange={(event) => change({ niche: event.target.value || undefined })}>
            <option value="">Todos</option>
            {reportNiches().map((niche) => <option key={niche} value={niche}>{reportNicheLabel(niche)}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">
          Cidade
          <select className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
            value={filters.city ?? ''} onChange={(event) => change({ city: event.target.value || undefined })}>
            <option value="">Todas</option>
            {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">
          Status
          <select className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink disabled:opacity-50"
            value={statuses ? filters.status ?? '' : ''} disabled={!statuses}
            onChange={(event) => change({ status: event.target.value || undefined })}>
            <option value="">{statuses ? 'Todos' : 'Não se aplica'}</option>
            {statuses?.map((status) => <option key={status} value={status}>{reportStatusLabel(view, status)}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">
          Serviço
          <select className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
            value={filters.service ?? ''} onChange={(event) => change({ service: event.target.value || undefined })}>
            <option value="">Todos</option>
            {options.services.map((service) => <option key={service} value={service}>{service}</option>)}
          </select>
        </label>
        {filters.period === 'custom' && (
          <>
            <label className="text-sm text-muted">
              Data inicial
              <input type="date" className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
                value={filters.startDate ?? ''} onChange={(event) => change({ startDate: event.target.value || undefined })} />
            </label>
            <label className="text-sm text-muted">
              Data final
              <input type="date" className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
                value={filters.endDate ?? ''} onChange={(event) => change({ endDate: event.target.value || undefined })} />
            </label>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Datas inclusivas em America/Sao_Paulo; o fim é exclusivo no servidor.</p>
    </Card>
  )
}
```

Criar `src/components/reports/ReportMetric.tsx`:

```tsx
import type { ReportRate } from '../../types/report'
import { Card } from '../ui/Card'

interface ReportMetricProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'accent' | 'danger'
}

export function ReportMetric({ label, value, hint, tone = 'default' }: ReportMetricProps) {
  return (
    <Card className={tone === 'danger' ? 'border-danger/40' : tone === 'accent' ? 'border-accent/40' : ''}>
      <div role="group" aria-label={label}>
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  )
}

export function ReportRateMetric({ label, rate }: { label: string; rate: ReportRate }) {
  const conclusive = rate.sufficient && rate.value !== null
  const value = conclusive
    ? `${(rate.value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    : rate.denominator === 0 ? 'Sem base de cálculo' : 'Dados insuficientes para conclusão'
  return (
    <ReportMetric
      label={label}
      value={value}
      hint={`${rate.numerator} de ${rate.denominator} registros`}
      tone={conclusive ? 'accent' : 'default'}
    />
  )
}
```

Criar `src/components/reports/ReportsPageStates.tsx`:

```tsx
import { AlertTriangle, BarChart3 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'
import { Spinner } from '../ui/Spinner'

export function ReportLoading() {
  return (
    <Card role="status">
      <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="h-4 w-4" /> Carregando relatório…</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24" />)}
      </div>
    </Card>
  )
}

export function ReportEmpty({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={BarChart3} title={title} description={description} />
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-danger/40" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="text-sm text-danger">{message}</p>
          <Button variant="outline" className="mt-3" onClick={onRetry}>Tentar novamente</Button>
        </div>
      </div>
    </Card>
  )
}
```

Criar `src/components/reports/ReportExportButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { exportReport } from '../../services/reportService'
import type {
  ReportExportFile, ReportExportModule, ReportFilters, ReportView,
} from '../../types/report'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

const MODULES: Record<ReportView, ReportExportModule[]> = {
  prospecting: ['leads'], opportunities: ['opportunities'], clients: ['clients'],
  projects: ['projects'], financial: ['receipts', 'expenses'], consolidated: ['consolidated'],
}

const LABELS: Record<ReportExportModule, string> = {
  leads: 'Leads', opportunities: 'Oportunidades', clients: 'Clientes', projects: 'Projetos',
  receipts: 'Recebimentos e estornos', expenses: 'Despesas', consolidated: 'Consolidado',
}

interface ReportExportButtonProps {
  view: ReportView
  filters: ReportFilters
}

export function ReportExportButton({ view, filters }: ReportExportButtonProps) {
  const available = MODULES[view]
  const [selection, setSelection] = useState<{ view: ReportView; module: ReportExportModule }>({
    view, module: available[0],
  })
  const module = selection.view === view && available.includes(selection.module)
    ? selection.module
    : available[0]
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<ReportExportFile | null>(null)
  const activeRef = useRef(false)
  const requestVersion = useRef(0)
  const scopeKey = JSON.stringify(filters)

  useEffect(() => {
    requestVersion.current += 1
    activeRef.current = false
    setExporting(false)
    setProgress(null)
    setError(null)
    setCompleted(null)
    activeRef.current = true
    return () => {
      activeRef.current = false
      requestVersion.current += 1
    }
  }, [view, scopeKey])

  const download = (file: ReportExportFile) => {
    const url = URL.createObjectURL(new Blob([file.csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const run = async () => {
    const version = requestVersion.current + 1
    requestVersion.current = version
    activeRef.current = true
    setExporting(true)
    setError(null)
    setCompleted(null)
    setProgress({ loaded: 0, total: 0 })
    try {
      const file = await exportReport(module, filters, (loaded, total) => {
        if (activeRef.current && requestVersion.current === version) setProgress({ loaded, total })
      })
      if (!activeRef.current || requestVersion.current !== version) return
      download(file)
      setCompleted(file)
    } catch (cause) {
      if (!activeRef.current || requestVersion.current !== version) return
      setError(cause instanceof Error ? cause.message : 'Erro ao exportar relatório.')
    } finally {
      if (activeRef.current && requestVersion.current === version) setExporting(false)
    }
  }

  return (
    <Card title="Exportar CSV">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          Módulo
          <select className="mt-1 block rounded-xl border border-line bg-bg px-3 py-2 text-ink"
            value={module} disabled={exporting}
            onChange={(event) => setSelection({ view, module: event.target.value as ReportExportModule })}>
            {available.map((item) => <option key={item} value={item}>{LABELS[item]}</option>)}
          </select>
        </label>
        <Button loading={exporting} onClick={() => { void run() }}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>
      {progress && exporting && (
        <p role="status" className="mt-3 text-xs text-muted">
          {progress.total > 0 ? `${progress.loaded} de ${progress.total} registros` : 'Preparando exportação…'}
        </p>
      )}
      {completed && <p role="status" className="mt-3 text-xs text-mint">Download de {completed.total} registro(s) concluído.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </Card>
  )
}
```

- [ ] **Step 3: Implementar o módulo lazy de gráficos e tabelas acessíveis**

Criar `src/components/reports/ReportCharts.tsx`:

```tsx
import type { ReactNode } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatReportMoney } from '../../lib/reports'
import { reportGroupLabel, reportNicheLabel } from '../../types/report'
import type { ReportData, ReportSeriesPoint } from '../../types/report'
import { Card } from '../ui/Card'

const AXIS = { stroke: '#a3a3a3', fontSize: 11 }
const GRID = '#2a2a2a'
const TOOLTIP = { backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff' }

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number | null>> }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted">Ver dados da tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead><tr>{headers.map((header) => <th key={header} className="border-b border-line p-2">{header}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-line/60 p-2">{cell ?? ''}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Chart({ title, children, headers, rows }: {
  title: string
  children: ReactNode
  headers: string[]
  rows: Array<Array<string | number | null>>
}) {
  return (
    <Card title={title}>
      <div className="h-64">{children}</div>
      <DataTable headers={headers} rows={rows} />
    </Card>
  )
}

function CountBars({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) {
  return (
    <Chart title={title} headers={['Categoria', 'Quantidade']} rows={data.map((item) => [item.label, item.count])}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={55} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip contentStyle={TOOLTIP} />
          <Bar dataKey="count" name="Quantidade" fill="#6db5ff" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Chart>
  )
}

function MoneyBars({ title, data }: { title: string; data: Array<{ label: string; amountCents: number }> }) {
  return (
    <Chart title={title} headers={['Categoria', 'Valor']} rows={data.map((item) => [item.label, formatReportMoney(item.amountCents)])}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={55} />
          <YAxis {...AXIS} tickFormatter={(value: number) => formatReportMoney(value)} />
          <Tooltip contentStyle={TOOLTIP} formatter={(value) => formatReportMoney(Number(value))} />
          <Bar dataKey="amountCents" name="Valor" fill="#ff5de7" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Chart>
  )
}

function SeriesArea({ title, data }: { title: string; data: ReportSeriesPoint[] }) {
  return (
    <Chart title={title} headers={['Período', 'Quantidade']} rows={data.map((item) => [item.label, item.count])}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip contentStyle={TOOLTIP} />
          <Area type="monotone" dataKey="count" name="Quantidade" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    </Chart>
  )
}

function ProspectingCharts({ data }: { data: Extract<ReportData, { cohort: unknown }> }) {
  const conversion = data.series.map((point) => {
    const rate = point.rate
    const numerator = point.numerator ?? rate?.numerator ?? 0
    const denominator = point.denominator ?? rate?.denominator ?? point.count
    const value = rate?.sufficient === true && rate.value !== null && rate.value !== undefined
      ? rate.value * 100
      : null
    const display = denominator === 0
      ? 'Sem base de cálculo'
      : value === null
        ? `Dados insuficientes para conclusão: ${numerator} de ${denominator} registros`
        : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    return { label: point.label, value, numerator, denominator, display }
  })
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SeriesArea title="Cadastros da coorte por período" data={data.series} />
      <Chart title="Evolução da conversão da coorte" headers={['Período', 'Conversões', 'Base', 'Taxa']}
        rows={conversion.map((point) => [point.label, point.numerator, point.denominator, point.display])}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={conversion}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} /><YAxis {...AXIS} unit="%" /><Tooltip contentStyle={TOOLTIP} />
            <Line type="monotone" dataKey="value" name="Conversão" stroke="#fefa3d" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Chart>
      <CountBars title="Status atual da coorte (snapshot)" data={data.byStatus.map((item) => ({ label: reportGroupLabel('prospecting', 'status', item.key), count: item.count }))} />
      <CountBars title="Coorte por nicho" data={data.byNiche.map((item) => ({ label: reportGroupLabel('prospecting', 'niche', item.key), count: item.count }))} />
      <CountBars title="Coorte por cidade" data={data.byCity.map((item) => ({ label: item.label, count: item.count }))} />
      <CountBars title="Coorte por serviço" data={data.byService.map((item) => ({ label: item.label, count: item.count }))} />
    </div>
  )
}

function OpportunityCharts({ data }: { data: Extract<ReportData, { totalLeads: number }> }) {
  const conversion = [
    { label: 'Leads convertidos no período', value: data.conversionRate.numerator },
    { label: 'Total de leads da coorte', value: data.conversionRate.denominator },
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Chart title="Conversão da coorte" headers={['Categoria', 'Leads']}
        rows={conversion.map((item) => [item.label, item.value])}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={conversion}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={55} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip contentStyle={TOOLTIP} />
            <Bar dataKey="value" name="Leads" fill="#fefa3d" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
      <CountBars title="Oportunidades por necessidade" data={data.byNeed.map((item) => ({ label: reportGroupLabel('opportunities', 'need', item.key), count: item.count }))} />
      <CountBars title="Oportunidades por prioridade" data={data.byPriority.map((item) => ({ label: reportGroupLabel('opportunities', 'priority', item.key), count: item.count }))} />
      <CountBars title="Distribuição por cidade" data={data.byCity.map((item) => ({ label: item.label, count: item.count }))} />
      <CountBars title="Distribuição por estado" data={data.byState.map((item) => ({ label: item.label, count: item.count }))} />
      <Chart title="Potencial estimado por serviço" headers={['Serviço', 'Valor estimado']}
        rows={data.byService.map((item) => [item.label, formatReportMoney(item.amountCents ?? 0)])}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byService.map((item) => ({ label: item.label, amountCents: item.amountCents ?? 0 }))}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} interval={0} angle={-20} textAnchor="end" height={55} />
            <YAxis {...AXIS} tickFormatter={(value: number) => formatReportMoney(value)} />
            <Tooltip contentStyle={TOOLTIP} formatter={(value) => formatReportMoney(Number(value))} />
            <Bar dataKey="amountCents" name="Valor estimado" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
      <CountBars title="Oportunidades por nicho" data={data.byNiche.map((item) => ({ label: reportGroupLabel('opportunities', 'niche', item.key), count: item.count }))} />
    </div>
  )
}

function ClientCharts({ data }: { data: Extract<ReportData, { historyTruncated: boolean }> }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SeriesArea title="Novos clientes por período" data={data.series} />
      <CountBars title="Clientes por status" data={data.byStatus.map((item) => ({ label: reportGroupLabel('clients', 'status', item.key), count: item.count }))} />
      <CountBars title="Clientes por nicho" data={data.byNiche.map((item) => ({ label: reportGroupLabel('clients', 'niche', item.key), count: item.count }))} />
      <CountBars title="Clientes por serviço" data={data.byService.map((item) => ({ label: item.label, count: item.count }))} />
    </div>
  )
}

function ProjectCharts({ data }: { data: Extract<ReportData, { productivity: ReportSeriesPoint[] }> }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SeriesArea title="Conclusões e entregas por período" data={data.productivity} />
      <CountBars title="Projetos por status" data={data.byStatus.map((item) => ({ label: reportGroupLabel('projects', 'status', item.key), count: item.count }))} />
    </div>
  )
}

function FinancialCharts({ data }: { data: Extract<ReportData, { cashFlow: unknown[] }> }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <MoneyBars title="Contratado ativo versus recebido líquido histórico" data={[
        { label: 'Contratado ativo', amountCents: data.contractedActiveCents },
        { label: 'Recebido líquido histórico', amountCents: data.receivedHistoricalCents },
      ]} />
      <Chart title="Recebimentos, despesas e lucro por período"
        headers={['Período', 'Recebimentos', 'Despesas', 'Líquido', 'Saldo']}
        rows={data.cashFlow.map((item) => [item.label, formatReportMoney(item.receiptsCents), formatReportMoney(item.expensesCents), formatReportMoney(item.netCents), formatReportMoney(item.balanceCents)])}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.cashFlow}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} /><YAxis {...AXIS} tickFormatter={(value: number) => formatReportMoney(value)} />
            <Tooltip contentStyle={TOOLTIP} formatter={(value) => formatReportMoney(Number(value))} />
            <Bar dataKey="receiptsCents" name="Recebimentos" fill="#22c55e" />
            <Bar dataKey="expensesCents" name="Despesas" fill="#ff5de7" />
            <Line type="monotone" dataKey="netCents" name="Líquido" stroke="#fefa3d" />
          </ComposedChart>
        </ResponsiveContainer>
      </Chart>
      <MoneyBars title="Despesas pagas por categoria"
        data={data.categories.map((item) => ({ label: item.name, amountCents: item.amountCents }))} />
      <Chart title="Saldo acumulado" headers={['Período', 'Saldo']}
        rows={data.cashFlow.map((item) => [item.label, formatReportMoney(item.balanceCents)])}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.cashFlow}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} /><YAxis {...AXIS} tickFormatter={(value: number) => formatReportMoney(value)} />
            <Tooltip contentStyle={TOOLTIP} formatter={(value) => formatReportMoney(Number(value))} />
            <Area type="monotone" dataKey="balanceCents" name="Saldo" stroke="#6db5ff" fill="#6db5ff" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </Chart>
      <Chart title="Recebimentos e estornos por forma de pagamento"
        headers={['Forma', 'Recebimentos', 'Estornos']}
        rows={data.paymentMethods.map((item) => [item.method, formatReportMoney(item.receiptsCents), formatReportMoney(item.refundsCents)])}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.paymentMethods.map((item) => ({ ...item, label: item.method }))}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} /><YAxis {...AXIS} tickFormatter={(value: number) => formatReportMoney(value)} />
            <Tooltip contentStyle={TOOLTIP} formatter={(value) => formatReportMoney(Number(value))} />
            <Bar dataKey="receiptsCents" name="Recebimentos" fill="#22c55e" />
            <Bar dataKey="refundsCents" name="Estornos" fill="#ff5de7" />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
    </div>
  )
}

function ConsolidatedCharts({ data }: { data: Extract<ReportData, { crossBuckets: unknown[] }> }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Chart title="Leads, clientes e projetos por período" headers={['Período', 'Leads', 'Clientes', 'Projetos']}
        rows={data.byPeriod.map((item) => [item.bucket, item.leads, item.clients, item.projects])}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.byPeriod}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" {...AXIS} /><YAxis allowDecimals={false} {...AXIS} /><Tooltip contentStyle={TOOLTIP} />
            <Bar dataKey="leads" name="Leads" fill="#6db5ff" />
            <Bar dataKey="clients" name="Clientes" fill="#22c55e" />
            <Bar dataKey="projects" name="Projetos" fill="#fefa3d" />
          </BarChart>
        </ResponsiveContainer>
      </Chart>
      <CountBars title="Movimentos por nicho" data={data.byNiche.map((item) => ({ label: reportNicheLabel(item.niche), count: item.movements }))} />
      <CountBars title="Movimentos por cidade" data={data.byCity.map((item) => ({ label: item.city, count: item.movements }))} />
      <CountBars title="Movimentos por serviço" data={data.byService.map((item) => ({ label: item.service, count: item.movements }))} />
    </div>
  )
}

export function ReportCharts({ data }: { data: ReportData }) {
  if ('cohort' in data) return <ProspectingCharts data={data} />
  if ('totalLeads' in data) return <OpportunityCharts data={data} />
  if ('historyTruncated' in data) return <ClientCharts data={data} />
  if ('productivity' in data) return <ProjectCharts data={data} />
  if ('cashFlow' in data) return <FinancialCharts data={data} />
  return <ConsolidatedCharts data={data} />
}
```

- [ ] **Step 4: Executar o teste GREEN e revisar**

Comando: `npm test -- src/components/reports/ReportComponents.test.tsx`
Resultado esperado: filtros, datas customizadas, amostra mínima, estados, módulos de export, progresso, download completo e falha sem parcial passando sem aviso de console.

Comando de revisão: `git diff --check`.

- [ ] **Step 5: Criar commit**

```bash
git add src/components/reports/ReportFiltersBar.tsx src/components/reports/ReportMetric.tsx \
  src/components/reports/ReportExportButton.tsx src/components/reports/ReportsPageStates.tsx \
  src/components/reports/ReportCharts.tsx src/components/reports/ReportComponents.test.tsx
git commit -m "feat: adicionar controles e gráficos dos relatórios"
```

---

### Task 11: Compor as seis visões e a página Relatórios

**Arquivos:**
- Criar: `src/components/reports/ReportViewContent.tsx`
- Criar: `src/pages/ReportsPage.tsx`
- Criar: `src/pages/ReportsPage.test.tsx`

**Interfaces:**
- Consome `useReportData`, `getReportFilterOptions`, `ReportFiltersBar`, `ReportExportButton`, `ReportMetric`, `ReportRateMetric`, `ReportsPageStates` e o módulo lazy `ReportCharts`.
- Produz `ReportViewContent({ data })` com indicadores, gráficos, tabelas, rankings e avisos literais das seis visões.
- Produz `ReportsPage` com abas, filtros compartilhados, opções reais, loading/vazio/erro, retry e snapshot preservado; trocar dono autenticado remonta o conteúdo para não reutilizar snapshot do owner anterior.
- `ReportCharts` entra somente via `lazy(() => import('./ReportCharts'))`; nenhum outro arquivo de Relatórios importa Recharts estaticamente.

- [ ] **Step 1: Escrever o teste RED de integração das seis visões**

Criar `src/pages/ReportsPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { User } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../components/auth/authContext'
import { REPORT_VIEWS, type ReportData, type ReportMeta, type ReportRate, type ReportView } from '../types/report'
import { ReportsPage } from './ReportsPage'

const { loadReportData, getReportFilterOptions, exportReport } = vi.hoisted(() => ({
  loadReportData: vi.fn(), getReportFilterOptions: vi.fn(), exportReport: vi.fn(),
}))
vi.mock('../services/reportService', () => ({ loadReportData, getReportFilterOptions, exportReport }))

vi.mock('recharts', () => {
  function Container({ children }: { children?: ReactNode }) { return <div>{children}</div> }
  function Chart({ data, children }: { data?: unknown; children?: ReactNode }) {
    return <div data-testid="chart" data-rows={JSON.stringify(data ?? [])}>{children}</div>
  }
  function Series({ children }: { children?: ReactNode }) { return <span data-testid="series">{children}</span> }
  function Empty() { return <span /> }
  return {
    ResponsiveContainer: Container, AreaChart: Chart, BarChart: Chart, ComposedChart: Chart, LineChart: Chart,
    Area: Series, Bar: Series, Line: Series, CartesianGrid: Empty, Tooltip: Empty, XAxis: Empty, YAxis: Empty,
  }
})

const USER_A = { id: 'usuario-a-sintetico', email: 'a@exemplo.invalid' } as User
const USER_B = { id: 'usuario-b-sintetico', email: 'b@exemplo.invalid' } as User
const signOut = vi.fn()

function meta(): ReportMeta {
  return {
    generatedAt: '2026-11-26T12:00:00Z', startDate: '2026-11-01', endDate: '2026-11-26',
    startAt: '2026-11-01T03:00:00Z', endAt: '2026-11-27T03:00:00Z',
    filters: { period: 'last_30_days' }, warnings: [],
  }
}
function rate(numerator: number, denominator: number): ReportRate {
  return { numerator, denominator, value: denominator === 0 ? null : numerator / denominator, sufficient: denominator >= 5 }
}
function reports(): Record<ReportView, ReportData> {
  return {
    prospecting: {
      meta: meta(), cohort: { total: 7 },
      events: { contacts: 6, contactedLeads: 5, responses: 2, respondedLeads: 2, conversions: 1 },
      rates: { response: rate(2, 5), conversion: rate(1, 7) },
      series: [
        { bucket: '2026-11-01', label: '01/11', count: 5, numerator: 1, denominator: 5, rate: rate(1, 5) },
        { bucket: '2026-11-02', label: '02/11', count: 2, numerator: 0, denominator: 2, rate: rate(0, 2) },
      ],
      byStatus: [{ key: 'novo', label: 'novo', count: 7 }],
      byNiche: [{ key: 'barbearia', label: 'barbearia', count: 7 }], byCity: [], byService: [],
      ranking: [
        { key: 'barbearia', label: 'barbearia', count: 3, rank: 1 },
        { key: 'pizzaria', label: 'pizzaria', count: 2, rank: 2 },
        { key: 'manicure', label: 'manicure', count: 1, rank: 3 },
        { key: 'cafeteria', label: 'cafeteria', count: 1, rank: 4 },
      ],
    },
    opportunities: {
      meta: meta(), totalLeads: 7, qualified: 4, notProspected: 2,
      instagramWithoutSiteConfirmed: 1, instagramWithoutSiteUnverified: 1,
      estimatedCents: 70000, negotiatedCents: 40000, contractedSnapshotCents: 20000, receivedLedgerCents: 10000,
      conversionRate: rate(1, 7),
      byNiche: [{ key: 'pizzaria', label: 'pizzaria', count: 4 }],
      byNeed: [{ key: 'site', label: 'site', count: 4 }],
      byPriority: [{ key: 'media', label: 'media', count: 4 }],
      byCity: [], byState: [], byService: [], ranking: [],
    },
    clients: {
      meta: meta(), total: 3, active: 2, inactive: 1, inProject: 1, pendingPayment: 1, pendingCents: 10000,
      newInPeriod: 2, conversionsInPeriod: 1, series: [],
      byStatus: [{ key: 'active', label: 'active', count: 2 }],
      byNiche: [{ key: 'manicure', label: 'manicure', count: 2 }], byCity: [], byService: [],
      history: [], historyTruncated: false,
    },
    projects: {
      meta: meta(), total: 2, delayed: 1, averageDurationDays: null, completionRate: rate(1, 2),
      byStatus: [{ key: 'in_development', label: 'in_development', count: 2 }],
      productivity: [], attention: {
        total: 1, delayed: 1, pendingReview: 0, pendingApproval: 0, overdueTasks: 0,
        items: [{ projectId: 'p1', projectName: 'Site da pizzaria', clientName: 'Pizzaria', service: 'Site', status: 'in_development', dueDate: '2026-11-20', reasons: ['Prazo vencido'] }],
        truncated: false,
      },
    },
    financial: {
      meta: meta(), contractedActiveCents: 100000, receivedHistoricalCents: 30000, pendingCents: 70000,
      periodReceiptsCents: 20000, periodRefundsCents: 5000, periodNetReceiptsCents: 15000,
      periodPaidExpensesCents: 4000, pendingExpensesCents: 2000, periodProfitCents: 11000,
      overdueCents: 7000, overdueExpensesCents: 2000,
      cashFlow: [{ label: '01/11', receiptsCents: 20000, expensesCents: 4000, netCents: 16000, balanceCents: 11000 }],
      categories: [], paymentMethods: [], overdue: [], upcoming: [], listsTruncated: false,
    },
    consolidated: {
      meta: meta(), totals: {
        leads: 7, clients: 3, projects: 2, movements: 2, receiptsCents: 20000, refundsCents: 5000,
        paidExpensesCents: 4000, netCents: 11000, leadEstimatedCents: 70000, leadNegotiatedCents: 40000,
        leadContractedSnapshotCents: 20000, contractContractedCents: 100000, projectContractedCents: 50000,
      },
      byPeriod: [], byNiche: [], byCity: [], byService: [], crossBuckets: [],
      crossBucketsTruncated: false, groupsTruncated: false,
    },
  }
}

function pageFor(user: User) {
  return (
    <MemoryRouter>
      <AuthContext.Provider value={{ session: null, user, loading: false, signOut }}>
        <ReportsPage />
      </AuthContext.Provider>
    </MemoryRouter>
  )
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

let consoleError: ReturnType<typeof vi.spyOn>
let consoleWarn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  loadReportData.mockReset()
  getReportFilterOptions.mockReset()
  exportReport.mockReset()
  getReportFilterOptions.mockResolvedValue({ cities: ['Santos'], services: ['Site'] })
  loadReportData.mockImplementation(async (view: ReportView) => reports()[view])
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

describe('ReportsPage', () => {
  it('expõe as seis abas e carrega Prospecção com dados reais mockados', async () => {
    render(pageFor(USER_A))
    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeTruthy()
    const tabs = screen.getByRole('navigation', { name: 'Visões de relatórios' })
    expect(tabs.querySelectorAll('button')).toHaveLength(6)
    expect(await screen.findByRole('group', { name: 'Coorte de cadastro' })).toBeTruthy()
    expect(loadReportData).toHaveBeenCalledWith('prospecting', { period: 'last_30_days' })
  })

  it('renderiza o indicador principal e os gráficos de cada visão', async () => {
    render(pageFor(USER_A))
    const signatures: Array<[ReportView, string, string]> = [
      ['prospecting', 'Prospecção', 'Coorte de cadastro'],
      ['opportunities', 'Oportunidades', 'Leads no período'],
      ['clients', 'Clientes', 'Total de clientes'],
      ['projects', 'Projetos', 'Total de projetos'],
      ['financial', 'Financeiro', 'Contratado ativo'],
      ['consolidated', 'Consolidado', 'Leads'],
    ]
    for (const [view, tab, metric] of signatures) {
      fireEvent.click(screen.getByRole('button', { name: tab }))
      expect(await screen.findByRole('group', { name: metric })).toBeTruthy()
      expect((await screen.findAllByTestId('chart')).length).toBeGreaterThan(0)
      if (view === 'opportunities') expect(screen.getByText('Conversão da coorte')).toBeTruthy()
      if (view === 'financial') {
        expect(screen.getByText('Contratado ativo versus recebido líquido histórico')).toBeTruthy()
      }
      expect(loadReportData).toHaveBeenLastCalledWith(view, { period: 'last_30_days' })
    }
    expect(REPORT_VIEWS).toHaveLength(6)
  })

  it('apresenta nichos, status, necessidades e prioridades com rótulos pt-BR', async () => {
    render(pageFor(USER_A))
    await screen.findByRole('group', { name: 'Coorte de cadastro' })
    expect(screen.getAllByText('Barbearia').length).toBeGreaterThan(0)
    expect(screen.queryByText('barbearia')).toBeNull()
    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getByText('1. Barbearia')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Oportunidades' }))
    await screen.findByRole('group', { name: 'Leads no período' })
    expect(screen.getByText('Precisa de site')).toBeTruthy()
    expect(screen.getByText('Média')).toBeTruthy()
    expect(screen.queryByText('site')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }))
    await screen.findByRole('group', { name: 'Total de clientes' })
    expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0)
    expect(screen.queryByText('active')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Projetos' }))
    await screen.findByRole('group', { name: 'Total de projetos' })
    expect(screen.getByText('Em desenvolvimento')).toBeTruthy()
    expect(screen.queryByText('in_development')).toBeNull()
  })

  it('suprime percentuais de séries sem amostra suficiente e conserva a base', async () => {
    render(pageFor(USER_A))
    await screen.findByRole('group', { name: 'Coorte de cadastro' })
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.queryByText(/^0(?:[.,]0)?%$/)).toBeNull()
    expect(screen.getByText('Dados insuficientes para conclusão: 0 de 2 registros')).toBeTruthy()
  })

  it('renderiza ranking com um grupo quando há pelo menos três registros', async () => {
    const prospecting = reports().prospecting as Extract<ReportData, { cohort: unknown }>
    prospecting.ranking = [{ key: 'barbearia', label: 'barbearia', count: 3, rank: 1 }]
    loadReportData.mockResolvedValueOnce(prospecting)
    render(pageFor(USER_A))
    await screen.findByRole('group', { name: 'Coorte de cadastro' })
    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getByText('1. Barbearia')).toBeTruthy()
    expect(screen.queryByText(/ranking exige ao menos 3 registros/)).toBeNull()
  })

  it('informa a quantidade de registros, não de grupos, no ranking insuficiente', async () => {
    const prospecting = reports().prospecting as Extract<ReportData, { cohort: unknown }>
    prospecting.ranking = [{ key: 'barbearia', label: 'barbearia', count: 2, rank: 1 }]
    loadReportData.mockResolvedValueOnce(prospecting)
    render(pageFor(USER_A))
    await screen.findByRole('group', { name: 'Coorte de cadastro' })
    expect(screen.getByText(/ranking exige ao menos 3 registros; há 2/)).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('aplica o mesmo filtro à visão e à exportação e remove status inaplicável', async () => {
    render(pageFor(USER_A))
    await screen.findByRole('group', { name: 'Coorte de cadastro' })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Santos' } })
    await waitFor(() => expect(loadReportData).toHaveBeenLastCalledWith(
      'prospecting', { period: 'last_30_days', city: 'Santos' },
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Financeiro' }))
    await screen.findByRole('group', { name: 'Contratado ativo' })
    expect((screen.getByLabelText('Status') as HTMLSelectElement).disabled).toBe(true)
    expect(loadReportData).toHaveBeenLastCalledWith('financial', { period: 'last_30_days', city: 'Santos' })
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeTruthy()
  })

  it('mostra loading antes do módulo lazy e só publica o snapshot após a resposta', async () => {
    const request = deferred<ReportData>()
    loadReportData.mockReturnValue(request.promise)
    render(pageFor(USER_A))
    expect(screen.getAllByRole('status').some((node) => node.textContent?.includes('Carregando relatório'))).toBe(true)
    expect(screen.queryAllByTestId('chart')).toHaveLength(0)

    request.resolve(reports().prospecting)
    expect(await screen.findByRole('group', { name: 'Coorte de cadastro' })).toBeTruthy()
    expect((await screen.findAllByTestId('chart')).length).toBeGreaterThan(0)
  })

  it('distingue relatório vazio de erro e permite retry', async () => {
    const empty = reports().prospecting as Extract<ReportData, { cohort: unknown }>
    loadReportData.mockResolvedValueOnce({
      ...empty, cohort: { total: 0 },
      events: { contacts: 0, contactedLeads: 0, responses: 0, respondedLeads: 0, conversions: 0 },
    })
    const utils = render(pageFor(USER_A))
    expect(await screen.findByRole('heading', { name: 'Nenhum dado no recorte' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()

    loadReportData.mockRejectedValueOnce(new Error('Falha ao consultar.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Falha ao consultar')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('group', { name: 'Coorte de cadastro' })).toBeTruthy()
    expect(utils.container).toBeTruthy()
  })

  it('falha das opções não bloqueia o relatório e oferece retry próprio', async () => {
    getReportFilterOptions.mockRejectedValueOnce(new Error('Opções indisponíveis.'))
    render(pageFor(USER_A))
    expect(await screen.findByRole('group', { name: 'Coorte de cadastro' })).toBeTruthy()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Opções indisponíveis')
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar opções' }))
    await waitFor(() => expect(getReportFilterOptions).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('option', { name: 'Santos' })).toBeTruthy()
  })

  it('remove o snapshot do owner anterior quando a autenticação muda', async () => {
    const second = deferred<ReportData>()
    loadReportData.mockResolvedValueOnce(reports().prospecting).mockReturnValueOnce(second.promise)
    const utils = render(pageFor(USER_A))
    await screen.findByRole('group', { name: 'Coorte de cadastro' })

    utils.rerender(pageFor(USER_B))
    expect(screen.queryByRole('group', { name: 'Coorte de cadastro' })).toBeNull()
    expect(screen.getAllByRole('status').some((node) => node.textContent?.includes('Carregando relatório'))).toBe(true)
    const next = reports().prospecting as Extract<ReportData, { cohort: unknown }>
    second.resolve({ ...next, cohort: { total: 1 } })
    await waitFor(() => expect(screen.getByRole('group', { name: 'Coorte de cadastro' }).textContent).toContain('1'))
  })
})
```

Comando: `npm test -- src/pages/ReportsPage.test.tsx`
Falha esperada: `ReportViewContent` e `ReportsPage` ausentes.

- [ ] **Step 2: Implementar o conteúdo literal das seis visões**

Criar `src/components/reports/ReportViewContent.tsx`:

```tsx
import { lazy, Suspense, type ReactNode } from 'react'
import { formatReportDate, formatReportDateTime, formatReportMoney } from '../../lib/reports'
import { reportGroupLabel, reportNicheLabel, reportStatusLabel } from '../../types/report'
import type {
  ReportAttentionItem, ReportCrossBucket, ReportData, ReportGroup, ReportReceivable,
} from '../../types/report'
import { Card } from '../ui/Card'
import { Skeleton } from '../ui/Skeleton'
import { ReportMetric, ReportRateMetric } from './ReportMetric'

const ReportCharts = lazy(() => import('./ReportCharts').then((module) => ({ default: module.ReportCharts })))
const count = (value: number) => value.toLocaleString('pt-BR')
const money = (cents: number) => cents < 0
  ? `-R$ ${formatReportMoney(Math.abs(cents))}`
  : `R$ ${formatReportMoney(cents)}`

function Metrics({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
}

function Charts({ data }: { data: ReportData }) {
  return (
    <Suspense fallback={<Card role="status"><Skeleton className="h-64" /><span className="sr-only">Carregando gráficos…</span></Card>}>
      <ReportCharts data={data} />
    </Suspense>
  )
}

function GroupTable({ title, rows, note, labelFor }: {
  title: string
  rows: ReportGroup[]
  note?: string
  labelFor?: (row: ReportGroup) => string
}) {
  return (
    <Card title={title}>
      {note && <p className="mb-3 text-xs text-muted">{note}</p>}
      {rows.length === 0 ? <p className="text-sm text-muted">Nenhum registro neste agrupamento.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr><th className="border-b border-line p-2">Categoria</th><th className="border-b border-line p-2">Quantidade</th><th className="border-b border-line p-2">Valor</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key}>
                <td className="border-b border-line/60 p-2">{labelFor?.(row) ?? row.label}</td>
                <td className="border-b border-line/60 p-2">{count(row.count)}</td>
                <td className="border-b border-line/60 p-2">{row.amountCents === undefined ? '—' : money(row.amountCents)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Ranking({ rows, labelFor }: { rows: ReportGroup[]; labelFor?: (row: ReportGroup) => string }) {
  const rankedRows = rows.filter((row) => row.rank !== null && row.rank !== undefined)
  const recordCount = rows.reduce((total, row) => total + row.count, 0)
  return (
    <Card title="Ranking">
      {recordCount < 3 ? (
        <p className="text-sm text-muted">Dados insuficientes para conclusão: o ranking exige ao menos 3 registros; há {recordCount}.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rankedRows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
              <span>{row.rank}. {labelFor?.(row) ?? row.label}</span><strong>{count(row.count)}</strong>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function CrossTable({ title, rows }: { title: string; rows: ReportCrossBucket[] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <p className="text-sm text-muted">Nenhum cruzamento no recorte.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr>
              {['Período', 'Nicho', 'Cidade', 'Serviço', 'Leads', 'Clientes', 'Projetos', 'Movimentos', 'Recebimentos', 'Estornos', 'Despesas pagas'].map((header) => (
                <th key={header} className="border-b border-line p-2">{header}</th>
              ))}
            </tr></thead>
            <tbody>{rows.map((row, index) => (
              <tr key={`${row.bucket}-${row.niche}-${row.city}-${row.service}-${index}`}>
                <td className="border-b border-line/60 p-2">{row.bucket}</td>
                <td className="border-b border-line/60 p-2">{reportNicheLabel(row.niche)}</td>
                <td className="border-b border-line/60 p-2">{row.city}</td>
                <td className="border-b border-line/60 p-2">{row.service}</td>
                <td className="border-b border-line/60 p-2">{count(row.leads)}</td>
                <td className="border-b border-line/60 p-2">{count(row.clients)}</td>
                <td className="border-b border-line/60 p-2">{count(row.projects)}</td>
                <td className="border-b border-line/60 p-2">{count(row.movements)}</td>
                <td className="border-b border-line/60 p-2">{money(row.receiptsCents)}</td>
                <td className="border-b border-line/60 p-2">{money(row.refundsCents)}</td>
                <td className="border-b border-line/60 p-2">{money(row.paidExpensesCents)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Receivables({ title, rows }: { title: string; rows: ReportReceivable[] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <p className="text-sm text-muted">Nenhuma parcela ou vencimento nesta lista.</p> : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={`${row.contractId}-${row.dueDate}`} className="rounded-xl border border-line px-3 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><strong>{row.clientName}</strong><span>{money(row.remainingCents)}</span></div>
              <p className="text-xs text-muted">{row.service} · vence em {formatReportDate(row.dueDate)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Prospecting({ data }: { data: Extract<ReportData, { cohort: unknown }> }) {
  return (
    <div className="flex flex-col gap-5">
      <Metrics>
        <ReportMetric label="Coorte de cadastro" value={count(data.cohort.total)} hint="Leads criados no período" />
        <ReportMetric label="Contatos" value={count(data.events.contacts)} hint="Eventos primeiro_contato, mensagem ou ligacao" />
        <ReportMetric label="Leads contatados" value={count(data.events.contactedLeads)} hint="Distintos no período" />
        <ReportMetric label="Respostas" value={count(data.events.responses)} hint="Eventos de resposta" />
        <ReportMetric label="Leads que responderam" value={count(data.events.respondedLeads)} hint="Distintos no período" />
        <ReportMetric label="Conversões no período" value={count(data.events.conversions)} hint="lead_client_links.converted_at" />
        <ReportRateMetric label="Taxa de resposta" rate={data.rates.response} />
        <ReportRateMetric label="Conversão da coorte" rate={data.rates.conversion} />
      </Metrics>
      <Charts data={data} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GroupTable title="Status atual da coorte (snapshot)" rows={data.byStatus} labelFor={(row) => reportGroupLabel('prospecting', 'status', row.key)} />
        <GroupTable title="Coorte por nicho" rows={data.byNiche} labelFor={(row) => reportGroupLabel('prospecting', 'niche', row.key)} />
        <GroupTable title="Coorte por cidade" rows={data.byCity} />
        <GroupTable title="Coorte por serviço" rows={data.byService} />
        <Ranking rows={data.ranking} labelFor={(row) => reportGroupLabel('prospecting', 'niche', row.key)} />
      </div>
    </div>
  )
}

function Opportunities({ data }: { data: Extract<ReportData, { totalLeads: number }> }) {
  return (
    <div className="flex flex-col gap-5">
      <Metrics>
        <ReportMetric label="Leads no período" value={count(data.totalLeads)} />
        <ReportMetric label="Oportunidades elegíveis" value={count(data.qualified)} hint="Necessidade confirmada e status elegível" />
        <ReportMetric label="Não prospectadas" value={count(data.notProspected)} hint="Status novo sem contato" />
        <ReportMetric label="Instagram sem site confirmado" value={count(data.instagramWithoutSiteConfirmed)} hint="Site = no" />
        <ReportMetric label="Instagram sem site não verificado" value={count(data.instagramWithoutSiteUnverified)} hint="Site = unverified" />
        <ReportMetric label="Potencial estimado" value={money(data.estimatedCents)} />
        <ReportMetric label="Negociado" value={money(data.negotiatedCents)} />
        <ReportMetric label="Contratado (snapshot comercial)" value={money(data.contractedSnapshotCents)} />
        <ReportMetric label="Recebido do ledger" value={money(data.receivedLedgerCents)} hint="Pagamentos menos estornos" />
        <ReportRateMetric label="Conversão" rate={data.conversionRate} />
      </Metrics>
      <Charts data={data} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GroupTable title="Oportunidades por necessidade" rows={data.byNeed} labelFor={(row) => reportGroupLabel('opportunities', 'need', row.key)} />
        <GroupTable title="Oportunidades por prioridade" rows={data.byPriority} labelFor={(row) => reportGroupLabel('opportunities', 'priority', row.key)} />
        <GroupTable title="Distribuição por nicho" rows={data.byNiche} labelFor={(row) => reportGroupLabel('opportunities', 'niche', row.key)} />
        <GroupTable title="Distribuição por cidade" rows={data.byCity} />
        <GroupTable title="Distribuição por estado" rows={data.byState} />
        <GroupTable title="Potencial por serviço" rows={data.byService} />
        <Ranking rows={data.ranking} />
      </div>
    </div>
  )
}

function Clients({ data }: { data: Extract<ReportData, { historyTruncated: boolean }> }) {
  const sources = { client: 'Cliente', lead: 'Lead vinculado', contract: 'Contrato' }
  return (
    <div className="flex flex-col gap-5">
      <Metrics>
        <ReportMetric label="Total de clientes" value={count(data.total)} hint="Snapshot do recorte" />
        <ReportMetric label="Clientes ativos" value={count(data.active)} />
        <ReportMetric label="Clientes inativos" value={count(data.inactive)} />
        <ReportMetric label="Em projeto" value={count(data.inProject)} hint="Projeto não cancelado e não concluído/entregue" />
        <ReportMetric label="Com pagamento pendente" value={count(data.pendingPayment)} />
        <ReportMetric label="Pendência atual" value={money(data.pendingCents)} hint="Saldo ativo, nunca negativo" />
        <ReportMetric label="Novos clientes" value={count(data.newInPeriod)} hint="created_at no período" />
        <ReportMetric label="Conversões no período" value={count(data.conversionsInPeriod)} hint="converted_at no período" />
      </Metrics>
      <Charts data={data} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GroupTable title="Clientes por status" rows={data.byStatus} labelFor={(row) => reportGroupLabel('clients', 'status', row.key)} />
        <GroupTable title="Clientes por nicho" rows={data.byNiche} note="Cliente convertido usa o nicho do lead vinculado." labelFor={(row) => reportGroupLabel('clients', 'niche', row.key)} />
        <GroupTable title="Clientes por cidade" rows={data.byCity} />
        <GroupTable title="Clientes por serviço" rows={data.byService} note="Contrato mais recente do cliente." />
      </div>
      <Card title="Histórico do período">
        {data.historyTruncated && <p role="status" className="text-xs text-muted">Histórico limitado aos 100 eventos mais recentes.</p>}
        {data.history.length === 0 ? <p className="text-sm text-muted">Nenhum evento no histórico do período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead><tr><th className="border-b border-line p-2">Quando</th><th className="border-b border-line p-2">Cliente</th><th className="border-b border-line p-2">Origem</th><th className="border-b border-line p-2">Evento</th></tr></thead>
              <tbody>{data.history.map((entry) => (
                <tr key={`${entry.source}-${entry.id}`}>
                  <td className="border-b border-line/60 p-2">{formatReportDateTime(entry.createdAt)}</td>
                  <td className="border-b border-line/60 p-2">{entry.clientName}</td>
                  <td className="border-b border-line/60 p-2">{sources[entry.source]}</td>
                  <td className="border-b border-line/60 p-2">{entry.type}: {entry.description}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function AttentionTable({ items }: { items: ReportAttentionItem[] }) {
  return (
    <Card title="Projetos que exigem atenção">
      {items.length === 0 ? <p className="text-sm text-muted">Nenhum projeto exige atenção.</p> : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.projectId} className="rounded-xl border border-line px-3 py-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><strong>{item.projectName}</strong><span>{item.clientName}</span></div>
              <p className="text-xs text-muted">{item.service} · {reportStatusLabel('projects', item.status)} · {item.reasons.join(', ')}</p>
              {item.dueDate && <p className="text-xs text-muted">Prazo: {formatReportDate(item.dueDate)}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Projects({ data }: { data: Extract<ReportData, { productivity: unknown }> }) {
  return (
    <div className="flex flex-col gap-5">
      <Metrics>
        <ReportMetric label="Total de projetos" value={count(data.total)} hint="Snapshot dos filtros; a taxa de conclusão usa a coorte criada no período" />
        <ReportMetric label="Atrasados" value={count(data.delayed)} hint="Prazo vencido sem conclusão/entrega/cancelamento" tone="danger" />
        <ReportMetric label="Prazo médio" value={data.averageDurationDays === null ? 'Sem amostra' : `${data.averageDurationDays.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`} />
        <ReportRateMetric label="Taxa de conclusão da coorte" rate={data.completionRate} />
        <ReportMetric label="Em revisão" value={count(data.attention.pendingReview)} />
        <ReportMetric label="Aguardando aprovação" value={count(data.attention.pendingApproval)} />
        <ReportMetric label="Tarefas vencidas" value={count(data.attention.overdueTasks)} />
        <ReportMetric label="Total em atenção" value={count(data.attention.total)} />
      </Metrics>
      <Charts data={data} />
      <div className="grid gap-5 lg:grid-cols-2">
        <GroupTable title="Projetos por status canônico" rows={data.byStatus} labelFor={(row) => reportGroupLabel('projects', 'status', row.key)} />
        <AttentionTable items={data.attention.items} />
      </div>
      {data.attention.truncated && <p role="status" className="text-xs text-muted">Lista de atenção limitada aos 50 projetos mais urgentes.</p>}
    </div>
  )
}

function Financial({ data }: { data: Extract<ReportData, { cashFlow: unknown }> }) {
  return (
    <div className="flex flex-col gap-5">
      <Metrics>
        <ReportMetric label="Contratado ativo" value={money(data.contractedActiveCents)} hint="Contratos não cancelados" />
        <ReportMetric label="Recebido líquido histórico" value={money(data.receivedHistoricalCents)} />
        <ReportMetric label="Pendente" value={money(data.pendingCents)} hint="Saldo ativo, nunca negativo" />
        <ReportMetric label="Recebimentos do período" value={money(data.periodReceiptsCents)} />
        <ReportMetric label="Estornos do período" value={money(data.periodRefundsCents)} />
        <ReportMetric label="Recebido líquido do período" value={money(data.periodNetReceiptsCents)} />
        <ReportMetric label="Despesas pagas do período" value={money(data.periodPaidExpensesCents)} />
        <ReportMetric label="Despesas pendentes" value={money(data.pendingExpensesCents)} />
        <ReportMetric label="Lucro realizado do período" value={money(data.periodProfitCents)} hint="Recebido líquido menos despesas pagas" tone="accent" />
        <ReportMetric label="Recebíveis vencidos" value={money(data.overdueCents)} tone="danger" />
        <ReportMetric label="Despesas vencidas" value={money(data.overdueExpensesCents)} tone="danger" />
      </Metrics>
      <Charts data={data} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Despesas pagas por categoria">
          {data.categories.length === 0 ? <p className="text-sm text-muted">Nenhuma despesa paga no período.</p> : (
            <ul className="flex flex-col gap-2">{data.categories.map((item, index) => (
              <li key={`${item.categoryId ?? 'sem-categoria'}-${index}`} className="flex justify-between gap-3 border-b border-line/60 py-2 text-sm">
                <span>{item.name}</span><strong>{money(item.amountCents)}</strong>
              </li>
            ))}</ul>
          )}
        </Card>
        <Card title="Formas de pagamento">
          {data.paymentMethods.length === 0 ? <p className="text-sm text-muted">Nenhum recebimento ou estorno no período.</p> : (
            <ul className="flex flex-col gap-2">{data.paymentMethods.map((item) => (
              <li key={item.method} className="border-b border-line/60 py-2 text-sm">
                <div className="flex justify-between gap-3"><strong>{item.method}</strong><span>{money(item.receiptsCents)}</span></div>
                <p className="text-xs text-muted">Estornos: {money(item.refundsCents)}</p>
              </li>
            ))}</ul>
          )}
        </Card>
        <Receivables title="Parcelas e vencimentos em atraso" rows={data.overdue} />
        <Receivables title="Próximos vencimentos" rows={data.upcoming} />
      </div>
      {data.listsTruncated && <p role="status" className="text-xs text-muted">As listas de vencimentos estão limitadas a 50 registros cada; os totais permanecem completos.</p>}
    </div>
  )
}

function Consolidated({ data }: { data: Extract<ReportData, { crossBuckets: unknown }> }) {
  const totals = data.totals
  return (
    <div className="flex flex-col gap-5">
      <Metrics>
        <ReportMetric label="Leads" value={count(totals.leads)} />
        <ReportMetric label="Clientes" value={count(totals.clients)} />
        <ReportMetric label="Projetos" value={count(totals.projects)} />
        <ReportMetric label="Movimentos financeiros" value={count(totals.movements)} />
        <ReportMetric label="Recebimentos" value={money(totals.receiptsCents)} />
        <ReportMetric label="Estornos" value={money(totals.refundsCents)} />
        <ReportMetric label="Despesas pagas" value={money(totals.paidExpensesCents)} />
        <ReportMetric label="Líquido" value={money(totals.netCents)} tone="accent" />
        <ReportMetric label="Leads estimados" value={money(totals.leadEstimatedCents)} />
        <ReportMetric label="Leads negociados" value={money(totals.leadNegotiatedCents)} />
        <ReportMetric label="Leads contratados (snapshot)" value={money(totals.leadContractedSnapshotCents)} />
        <ReportMetric label="Contratos ativos" value={money(totals.contractContractedCents)} />
        <ReportMetric label="Projetos contratados" value={money(totals.projectContractedCents)} />
      </Metrics>
      <Charts data={data} />
      <div className="grid gap-5">
        <CrossTable title="Consolidado por período" rows={data.byPeriod} />
        <CrossTable title="Consolidado por nicho" rows={data.byNiche} />
        <CrossTable title="Consolidado por cidade" rows={data.byCity} />
        <CrossTable title="Consolidado por serviço" rows={data.byService} />
        <CrossTable title="Cruzamento período/nicho/cidade/serviço" rows={data.crossBuckets} />
      </div>
      {(data.crossBucketsTruncated || data.groupsTruncated) && (
        <p role="status" className="text-xs text-muted">Agrupamentos extensos estão limitados; os totais exatos permanecem acima. Use o CSV consolidado para o cruzamento completo, sujeito ao limite de 10.000 registros.</p>
      )}
    </div>
  )
}

export function ReportViewContent({ data }: { data: ReportData }) {
  if ('cohort' in data) return <Prospecting data={data} />
  if ('totalLeads' in data) return <Opportunities data={data} />
  if ('historyTruncated' in data) return <Clients data={data} />
  if ('productivity' in data) return <Projects data={data} />
  if ('cashFlow' in data) return <Financial data={data} />
  return <Consolidated data={data} />
}
```

- [ ] **Step 3: Implementar a página, filtros compartilhados e estados**

Criar `src/pages/ReportsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ReportExportButton } from '../components/reports/ReportExportButton'
import { ReportFiltersBar } from '../components/reports/ReportFiltersBar'
import { ReportEmpty, ReportError, ReportLoading } from '../components/reports/ReportsPageStates'
import { ReportViewContent } from '../components/reports/ReportViewContent'
import { useAuth } from '../hooks/useAuth'
import { useReportData } from '../hooks/useReportData'
import { formatReportDate, formatReportDateTime } from '../lib/reports'
import { getReportFilterOptions } from '../services/reportService'
import {
  REPORT_VIEWS, reportStatusOptions, type ReportData, type ReportFilterOptions,
  type ReportFilters, type ReportView,
} from '../types/report'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

const VIEW_LABELS: Record<ReportView, string> = {
  prospecting: 'Prospecção', opportunities: 'Oportunidades', clients: 'Clientes',
  projects: 'Projetos', financial: 'Financeiro', consolidated: 'Consolidado',
}

interface OptionsState {
  data: ReportFilterOptions
  loading: boolean
  error: string | null
}

function isEmpty(data: ReportData): boolean {
  if ('cohort' in data) return data.cohort.total === 0 && Object.values(data.events).every((value) => value === 0)
  if ('totalLeads' in data) return data.totalLeads === 0
  if ('historyTruncated' in data) return data.total === 0
  if ('productivity' in data) return data.total === 0
  if ('cashFlow' in data) {
    return data.contractedActiveCents === 0 && data.receivedHistoricalCents === 0 && data.pendingCents === 0
      && data.periodReceiptsCents === 0 && data.periodRefundsCents === 0 && data.periodPaidExpensesCents === 0
      && data.pendingExpensesCents === 0 && data.overdue.length === 0 && data.upcoming.length === 0
  }
  const values = Object.values(data.totals)
  return values.every((value) => value === 0)
}

function ReportsContent() {
  const [view, setView] = useState<ReportView>('prospecting')
  const [filters, setFilters] = useState<ReportFilters>({ period: 'last_30_days' })
  const { data, loading, error, reload } = useReportData(view, filters)
  const [optionsReload, setOptionsReload] = useState(0)
  const [options, setOptions] = useState<OptionsState>({
    data: { cities: [], services: [] }, loading: true, error: null,
  })

  useEffect(() => {
    let active = true
    setOptions((current) => ({ ...current, loading: true, error: null }))
    void getReportFilterOptions().then(
      (result) => { if (active) setOptions({ data: result, loading: false, error: null }) },
      (cause: unknown) => {
        if (active) setOptions({
          data: { cities: [], services: [] }, loading: false,
          error: cause instanceof Error ? cause.message : 'Erro ao carregar opções de filtro.',
        })
      },
    )
    return () => { active = false }
  }, [optionsReload])

  const changeView = (next: ReportView) => {
    setView(next)
    if (reportStatusOptions(next) === null) {
      setFilters((current) => {
        const normalized = { ...current }
        delete normalized.status
        return normalized
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Relatórios</h1>
          <p className="text-sm text-muted">Indicadores e análises com dados reais do Supabase</p>
        </div>
        <Button variant="outline" onClick={reload}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>

      <nav aria-label="Visões de relatórios" className="flex flex-wrap gap-2">
        {REPORT_VIEWS.map((item) => (
          <Button key={item} variant={view === item ? 'primary' : 'outline'} aria-pressed={view === item} onClick={() => changeView(item)}>
            {VIEW_LABELS[item]}
          </Button>
        ))}
      </nav>

      <ReportFiltersBar view={view} filters={filters} options={options.data} onChange={setFilters} />
      {options.loading && <p role="status" className="text-xs text-muted">Carregando cidades e serviços reais…</p>}
      {options.error && (
        <Card className="border-danger/40" role="alert">
          <p className="text-sm text-danger">Não foi possível carregar as opções de filtro: {options.error}</p>
          <Button variant="outline" className="mt-3" onClick={() => setOptionsReload((token) => token + 1)}>Recarregar opções</Button>
        </Card>
      )}

      <ReportExportButton key={view} view={view} filters={filters} />

      {loading && !data && <ReportLoading />}
      {error && !data && <ReportError message={error} onRetry={reload} />}
      {loading && data && <p role="status" className="text-sm text-muted">Atualizando o último snapshot do mesmo recorte…</p>}
      {error && data && <ReportError message={`Não foi possível atualizar. Exibindo o último snapshot válido: ${error}`} onRetry={reload} />}

      {data && (
        <>
          <Card>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
              <span>Período: {formatReportDate(data.meta.startDate)} a {formatReportDate(data.meta.endDate)} (inclusive)</span>
              <span>Gerado em {formatReportDateTime(data.meta.generatedAt)} · America/Sao_Paulo</span>
            </div>
          </Card>
          {data.meta.warnings.length > 0 && (
            <Card role="status" title="Avisos do recorte">
              <ul className="list-disc pl-5 text-sm text-muted">{data.meta.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </Card>
          )}
          {isEmpty(data) ? (
            <ReportEmpty
              title="Nenhum dado no recorte"
              description="Ajuste o período ou os filtros. Nenhum número fictício é usado para preencher esta visão."
            />
          ) : <ReportViewContent data={data} />}
        </>
      )}
    </div>
  )
}

export function ReportsPage() {
  const { user } = useAuth()
  if (!user) return null
  return <ReportsContent key={user.id} />
}
```

- [ ] **Step 4: Executar o teste GREEN e revisar**

Comando: `npm test -- src/pages/ReportsPage.test.tsx src/components/reports/ReportComponents.test.tsx`
Resultado esperado: seis abas e visões, filtros compartilhados, módulo lazy, loading/vazio/erro, retry, opções reais e isolamento entre owners passando sem aviso de console.

Comando de revisão: `git diff --check`.

- [ ] **Step 5: Criar commit**

```bash
git add src/components/reports/ReportViewContent.tsx src/pages/ReportsPage.tsx src/pages/ReportsPage.test.tsx
git commit -m "feat: compor pagina e seis visoes de relatorios"
```

---

### Task 12: Ativar a rota lazy e isolar o Recharts do Dashboard

**Arquivos:**
- Modificar: `src/routes/AppRoutes.tsx`
- Modificar: `src/routes/AppRoutes.test.tsx`
- Criar: `src/components/dashboard/DashboardCharts.tsx`
- Modificar: `src/pages/DashboardPage.tsx`
- Modificar: `src/pages/DashboardPage.test.tsx`

**Interfaces:**
- `AppRoutes` importa `ReportsPage` somente com `lazy`; todas as rotas e imports existentes são preservados e apenas `/relatorios` deixa de ser placeholder.
- `DashboardCharts` recebe `byMonth`, `byNiche`, `byStatus`, `byPriority` e `funnel`; é o único arquivo do Dashboard que importa Recharts.
- `DashboardPage` conserva indicadores, relógio, snapshots, ações rápidas, follow-ups e painéis recentes; apenas os cinco gráficos ficam atrás de `Suspense`.

- [ ] **Step 1: Atualizar o teste RED da rota**

Fazer edições cirúrgicas em `src/routes/AppRoutes.test.tsx`, preservando todos os imports, mocks e testes existentes. Não substituir o arquivo integralmente.

Acrescentar o contador do carregamento lazy ao lado de `routeState`:

```tsx
const { reportsPageLoaded } = vi.hoisted(() => ({ reportsPageLoaded: vi.fn() }))
```

Acrescentar este mock após os mocks existentes de páginas:

```tsx
vi.mock('../pages/ReportsPage', () => {
  reportsPageLoaded()
  return { ReportsPage: () => <h1>Página de relatórios</h1> }
})
```

Limpar o contador no início do `beforeEach` existente, sem remover a autenticação nem os spies de console:

```tsx
reportsPageLoaded.mockClear()
```

Remover somente a linha `['/relatorios', 'Módulo relatorios'],` da tabela de rotas protegidas. Preservar `/clientes`, `/clientes/novo`, `/clientes/:id`, as rotas públicas, o redirecionamento de autenticação e o 404. Acrescentar ao `describe('AppRoutes')` existente:

```tsx
it('/relatorios carrega a página real sob demanda sem substituir as rotas existentes', async () => {
  renderPath('/relatorios')
  expect(screen.getByRole('status').textContent).toContain('Carregando relatórios')
  expect(await screen.findByRole('heading', { name: 'Página de relatórios' })).toBeTruthy()
  expect(reportsPageLoaded).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Rota protegida')).toBeTruthy()
  expect(screen.getByText('Layout do aplicativo')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Módulo relatorios' })).toBeNull()
})
```

Comando: `npm test -- src/routes/AppRoutes.test.tsx`
Falha esperada: `/relatorios` ainda renderiza `Módulo relatorios`.

- [ ] **Step 2: Editar a rota e criar o módulo lazy do Dashboard**

Fazer edições cirúrgicas em `src/routes/AppRoutes.tsx`. Preservar todos os imports e elementos de rota já existentes, incluindo `ClientsPage`, `ClientNewPage`, `ClientDetailPage`, `/clientes`, `/clientes/novo` e `/clientes/:id`. Não substituir o arquivo integralmente nem reverter rotas eventualmente implementadas pelos Planos 2–3.

Acrescentar o import do React:

```tsx
import { lazy, Suspense } from 'react'
```

Acrescentar após os imports existentes:

```tsx
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
```

Substituir somente a rota atual de `/relatorios` por:

```tsx
<Route path="/relatorios" element={(
  <Suspense fallback={<div role="status" className="p-5 text-sm text-muted">Carregando relatórios…</div>}>
    <ReportsPage />
  </Suspense>
)} />
```

Criar `src/components/dashboard/DashboardCharts.tsx`:

```tsx
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PRIORITY_LABELS } from '../../types/lead'
import { ChartCard } from './ChartCard'

const AXIS = { stroke: '#a3a3a3', fontSize: 11 }
const GRID = '#2a2a2a'
const TOOLTIP_STYLE = {
  backgroundColor: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 12, color: '#fff', fontSize: 12,
}
const PRIORITY_COLORS: Record<string, string> = {
  [PRIORITY_LABELS.muito_alta]: '#ff5de7',
  [PRIORITY_LABELS.alta]: '#fefa3d',
  [PRIORITY_LABELS.media]: '#6db5ff',
  [PRIORITY_LABELS.baixa]: '#a3a3a3',
}

interface NamedCount { label: string; total: number }
interface DashboardChartsProps {
  byMonth: Array<{ month: string; total: number }>
  byNiche: NamedCount[]
  byStatus: NamedCount[]
  byPriority: NamedCount[]
  funnel: NamedCount[]
}

export function DashboardCharts({ byMonth, byNiche, byStatus, byPriority, funnel }: DashboardChartsProps) {
  return (
    <>
      <ChartCard title="Leads cadastrados ao longo do tempo">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={byMonth}>
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
          <BarChart data={byNiche}>
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
          <BarChart data={byStatus}>
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
          <BarChart data={byPriority}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="total" name="Oportunidades" radius={[6, 6, 0, 0]}>
              {byPriority.map((entry) => <Cell key={entry.label} fill={PRIORITY_COLORS[entry.label] ?? '#a3a3a3'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Conversão de leads">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={funnel} layout="vertical">
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} {...AXIS} />
            <YAxis type="category" dataKey="label" width={90} {...AXIS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="total" name="Leads" fill="#fefa3d" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}
```

- [ ] **Step 3: Trocar os gráficos estáticos do Dashboard por Suspense**

Em `src/pages/DashboardPage.tsx`:

1. Trocar `import { useEffect, useMemo, useRef, useState } from 'react'` por:

```tsx
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
```

2. Remover o import de `recharts`, o import de `PRIORITY_LABELS`, o import de `ChartCard` e as constantes `AXIS`, `GRID`, `TOOLTIP_STYLE` e `PRIORITY_COLORS`.

3. Acrescentar após os imports:

```tsx
const DashboardCharts = lazy(() => import('../components/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardCharts })))
```

4. Substituir somente os cinco `<ChartCard>` dentro do grid por:

```tsx
<Suspense fallback={(
  <>
    <span role="status" className="sr-only">Carregando gráficos…</span>
    {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-72" />)}
  </>
)}>
  <DashboardCharts
    byMonth={byMonth}
    byNiche={charts.byNiche}
    byStatus={charts.byStatus}
    byPriority={charts.byPriority}
    funnel={charts.funnel}
  />
</Suspense>
```

O `<Card title="Próximos follow-ups">` permanece como sexto filho do mesmo grid, fora do `Suspense`, para continuar visível enquanto o chunk de gráficos carrega.

- [ ] **Step 4: Fazer os testes do Dashboard aguardarem o chunk lazy**

Em `src/pages/DashboardPage.test.tsx`, substituir `settle()` por:

```tsx
async function settle() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => { await Promise.resolve() })
  }
  // O módulo é dinâmico de propósito: carregá-lo dentro de act evita depender de timers reais
  // quando a suíte usa relógio falso, sem tornar o import estático no teste.
  await act(async () => { await import('../components/dashboard/DashboardCharts') })
  for (let i = 0; i < 8; i += 1) {
    await act(async () => { await Promise.resolve() })
  }
}
```

Substituir `renderLoaded()` por:

```tsx
async function renderLoaded(overrides: Partial<DashboardData> = {}) {
  mockData(overrides)
  const utils = renderPage()
  await settle()
  const loaded = dashboardData(overrides)
  const hasAnyData = loaded.convertedCount > 0 || loaded.leads.length > 0 || loaded.followups.length > 0
    || loaded.recentActivities.length > 0 || loaded.recentStatusChanges.length > 0 || loaded.recentLeads.length > 0
  if (hasAnyData) await screen.findAllByTestId('chart')
  return utils
}
```

Não alterar os demais testes nem expectativas de indicadores, cores, linhas, follow-ups e painéis recentes.

- [ ] **Step 5: Executar testes GREEN e revisar**

Comandos:

```bash
npm test -- src/routes/AppRoutes.test.tsx src/pages/DashboardPage.test.tsx src/pages/ReportsPage.test.tsx
git diff --check
```

Resultado esperado: rota lazy, rotas e testes anteriores preservados, cinco gráficos do Dashboard com os mesmos dados/cores e todas as jornadas anteriores passando sem aviso de console.

- [ ] **Step 6: Criar commit**

```bash
git add src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx \
  src/components/dashboard/DashboardCharts.tsx src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "perf: carregar relatorios e recharts sob demanda"
```

---

### Task 13: Validar em navegador local, executar o gate final e commitar

**Arquivos:**
- Modificar apenas se o gate revelar defeito: os arquivos já listados nas Tasks 1–12.
- Não criar documentação, Etapa 4, scripts de deploy ou configuração de CI neste plano.

**Interfaces:**
- Consome a aplicação local, Supabase local descartável e exclusivamente registros sintéticos do owner de teste.
- Produz evidência fresca dos comandos e do smoke browser; nenhuma métrica de velocidade é declarada sem medição.
- O commit final consolida somente Relatórios e a extração lazy do Dashboard; não envia nada ao remoto.

- [ ] **Step 1: Reconstruir e validar o banco local**

Comandos:

```bash
npx supabase db reset
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_reports.sql
```

Resultado esperado: migrations `0001`–`0010` aplicadas somente no banco local e todos os probes de métricas, cursor, privilégios e isolamento entre dois owners aprovados. Se `LOCAL_DATABASE_URL` não estiver definido, obter a conexão local com `npx supabase status -o env` e exportar somente `LOCAL_DATABASE_URL` no shell da execução; nunca usar a connection string remota.

- [ ] **Step 2: Preparar o smoke browser com dados sintéticos isolados**

Comandos em terminais separados:

```bash
npm run dev
```

No navegador, abrir `http://localhost:5173/login`, criar uma conta local de teste e usar essa conta somente neste banco descartável. Cadastrar pela interface, em nome dos dados sintéticos:

1. Um lead `Lead sintético de relatório`, com nicho/cidade/serviço, uma necessidade e uma atividade de contato e outra de resposta.
2. A conversão desse lead para cliente, um contrato ativo com parcelas, um recebimento alocado, um estorno parcial alocado, uma despesa paga e uma despesa pendente.
3. Um projeto criado no período, uma conclusão/entrega e um projeto atrasado para a lista de atenção.
4. Um segundo lead com nome `=1+1` para inspecionar a proteção de fórmula no CSV.

Todos esses registros são sintéticos e existem apenas no Supabase local. A interface deve continuar identificando a fonte como dados reais do banco, sem apresentar esses valores como dados de produção.

- [ ] **Step 3: Executar o smoke das seis visões e da responsividade**

Abrir `http://localhost:5173/relatorios` e verificar, sem usar dados de produção:

- As abas Prospecção, Oportunidades, Clientes, Projetos, Financeiro e Consolidado exibem indicadores, gráficos e tabelas; nenhuma visão mostra número fictício.
- Trocar período para `Personalizado`, usar `2026-11-20` a `2026-11-26`, conferir o período exibido e repetir a troca de cidade/nicho/serviço; indicadores, gráficos e seleção do módulo de exportação usam o mesmo recorte.
- Financeiro e Consolidado mantêm Status desabilitado; uma visão com status canônico o habilita.
- Conferir que Prospecção rotula coorte, snapshot e eventos; Clientes diferencia novos de conversões; Projetos diferencia coorte de produtividade; Financeiro separa estimado/negociado/contratado/recebido e mostra recebido menos estornos.
- Taxas com denominador zero mostram `Sem base de cálculo`; amostra abaixo de cinco e ranking abaixo de três mostram contagem e `Dados insuficientes para conclusão`.
- Exportar Recebimentos e Despesas, abrir os arquivos e conferir BOM UTF-8, `;`, datas/timestamps pt-BR, dinheiro com duas casas e o nome `=1+1` precedido por apóstrofo. Não aceitar download se qualquer página falhar.
- Testar loading, vazio com filtro sem resultados e erro interrompendo a conexão local; o retry deve recuperar e a falha de atualização deve preservar o último snapshot do mesmo escopo.
- Criar uma segunda conta local sintética própria para o smoke (por exemplo, com email no domínio `example.test`) e cadastrar nela ao menos um lead. Entrar com essa conta e confirmar que visões, opções de filtro e exports contêm somente os registros sintéticos desse owner, sem dado do primeiro owner. Não reutilizar os UUIDs inseridos diretamente pelo teste SQL: a transação termina em `rollback` e eles não são contas de login.
- Repetir em 1440 px, 768 px e 390 px: sem rolagem horizontal do corpo, abas/filtros/utilizáveis, tabelas com rolagem apenas no próprio contêiner e gráficos legíveis.
- Abrir o Dashboard antes e depois de Relatórios e conferir que os cinco gráficos, indicadores, follow-ups e painéis recentes permanecem; observar no Network que o chunk de gráficos é solicitado sob demanda, sem declarar tempo de carregamento não medido.

Se qualquer item falhar, corrigir o arquivo responsável, repetir o teste direcionado e só então seguir para o gate.

- [ ] **Step 4: Executar o gate final completo**

Comandos:

```bash
npm test -- --maxWorkers=2
npm run build
npm run lint
git diff --check
```

Resultado esperado: suíte completa, build TypeScript/Vite e Oxlint aprovados, sem erros de whitespace. Não pular hook, não usar `--no-verify`, não executar push/deploy e não alterar SQL remoto. Uma falha interrompe o gate; corrigir e repetir o comando completo antes do commit.

- [ ] **Step 5: Revisar escopo e diff sem commitar**

Comandos:

```bash
git status --short
git diff --stat
git diff --check
git diff --cached --check
```

Confirmar que o diff não inclui `.env`, credenciais, `dist`, dados de produção nem alterações nos Planos 1–3. Confirmar que `src/components/reports/ReportCharts.tsx` e `src/components/dashboard/DashboardCharts.tsx` são os únicos módulos novos que importam Recharts e que ambos entram por `lazy`.

Encerrar esta etapa com o resumo das evidências, dos arquivos alterados e de qualquer pendência. Aguardar aprovação explícita do usuário para o commit final; não fazer stage, commit, push ou deploy antes dessa aprovação.

- [ ] **Step 6: Criar o commit final somente após aprovação**

Após a aprovação explícita, fazer stage apenas dos arquivos revisados:

```bash
git add src/types/report.ts src/types/report.test.ts src/lib/reports.ts src/lib/reports.test.ts \
  supabase/migrations/0010_etapa3_reports.sql supabase/tests/etapa3_reports.sql \
  src/services/reportService.ts src/services/reportService.test.ts \
  src/hooks/useReportData.ts src/hooks/useReportData.test.tsx \
  src/components/reports/ReportFiltersBar.tsx src/components/reports/ReportMetric.tsx \
  src/components/reports/ReportExportButton.tsx src/components/reports/ReportsPageStates.tsx \
  src/components/reports/ReportCharts.tsx src/components/reports/ReportComponents.test.tsx \
  src/components/reports/ReportViewContent.tsx src/pages/ReportsPage.tsx src/pages/ReportsPage.test.tsx \
  src/components/dashboard/DashboardCharts.tsx src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx \
  src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx \
  docs/superpowers/plans/2026-11-26-etapa3-relatorios.md
git diff --cached --check
git commit -m "feat: finalizar relatorios e exports da etapa 3"
git status --short
```

Se o hook falhar, corrigir a causa, repetir o gate completo e solicitar nova revisão; nunca usar `--no-verify`.

- [ ] **Step 7: Classificar o resultado sem ampliar o escopo**

Retornar na sessão de execução:

- Tasks concluídas e testes que passaram com evidência fresca.
- Migration/RLS local executada; aplicar em Supabase remoto continua `dependente de configuração externa` e não foi feita.
- Smoke browser e larguras efetivamente verificadas.
- Build/lint/suíte completa aprovados ou a falha específica que bloqueia o commit.
- Relatórios classificados como `concluído/testado` somente após o gate; caso contrário, `implementado/não testado`.
- Configurações, Backup/Restore, auditoria `0013`, CI/documentação da finalização e deploy não pertencem a este plano e não são declarados concluídos. O CRM integral só será classificado como finalizado quando os planos correspondentes e os critérios globais da spec também estiverem satisfeitos.

---
