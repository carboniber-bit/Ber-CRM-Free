# Etapa 3: configurações, backup e restore — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**

Entregar configurações versionadas e validadas no cliente e no PostgreSQL, categorias de receita e categoria textual de tarefa, backup ZIP local com manifesto/hashes/limites, diagnóstico read-only, prévia de restore sem sobrescrita e restore transacional para o proprietário autenticado, preservando os contratos dos Planos 1–3.

**Architecture:**

- `user_settings` continua sendo a linha legada de configurações. `0011` acrescenta `preferences jsonb` versão 1, mantendo `service_prices` e `whatsapp_template`.
- As telas consomem `UserPreferences` por um provider opcional; sem provider, usam `DEFAULT_PREFERENCES`. Nenhum código de status é criado.
- `0011` também cria `revenue_categories`, adiciona `financial_payments.revenue_category_id` e adiciona `project_tasks.category`.
- A ordem canônica de aplicação é `0011_etapa3_settings.sql` → `0012_etapa3_backup.sql` → `0013_etapa3_security_audit.sql`. O `0013` é o único dono de `audit_events`, `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid` e dos triggers de auditoria. Este plano não cria nem redefine esses objetos; settings e restore somente os consomem em runtime, após o preflight de `to_regprocedure`.
- `0012` cria funções puras de registro/validação, funções de staging temporária, `preview_backup_restore(jsonb)`, `restore_backup(jsonb,text,text)` e `get_backup_diagnostics()`.
- O ZIP é montado e desmontado no navegador com `fflate`. O parser verifica manifesto e hashes antes de enviar um pacote canônico à RPC. O servidor revalida schema, proprietário, linhas, valores, relações e conflitos; nenhum `owner_id` do arquivo concede autorização.
- A prévia não grava dados de negócio. O restore usa staging temporária, classifica todas as linhas antes da escrita, insere somente novas em ordem de dependência e aborta diante de qualquer conflito. Tabelas financeiras são restauradas por RPC dedicada, na mesma transação, com locks canônicos antes das linhas e sem INSERT direto para `authenticated`.
- Relatórios (`0010`) e qualquer Etapa 4 ficam fora deste plano.

**Tech Stack:**

React 19, TypeScript strict, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free/PostgreSQL, PostgREST/RPC, Vitest 5, Testing Library, jsdom, Papa Parse, `fflate`.

**Spec:**

Autoridade: `docs/superpowers/specs/2026-11-26-etapa3-finalizacao-design.md`, especialmente seções 8–10 e 12–14.

Contratos consumidos:

- Plano 1: `Client`, `Contract`, `Project`, `LeadClientLink`, `ClientActivity`, `CLIENT_STATUSES`, `PROJECT_STATUSES`, `parseMoneyInput`, `fromMoneyDecimal`, `toMoneyDecimal`, `MAX_MONEY_CENTS`.
- Etapa 2: `LEAD_STATUSES`, `NICHES`, `NEEDS`, `LeadStatus`, `Niche`, `Need`, `LeadSort` e `leads.maps_url`.
- Plano 2: `ProjectTask`, `ProjectTaskWrite`, `TASK_STATUSES`, `calculateProjectProgress`, `taskPayload`, `reorder_project_tasks(uuid,uuid[])`.
- Plano 3: `FinancialPayment`, `PaymentInput`, `PaymentAllocation`, `Installment`, `FinancialExpense`, `ExpenseCategory`, `record_payment(jsonb)`, `create_expense_category(text)`, `archive_expense_category(uuid)`.
- Etapa 3/`0013`: `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid`, com `actor_id = owner_id`, `entity_id text` e metadados allowlisted. A função é consumida em runtime e não criada neste plano.
- Migrations atuais: `0001_profiles.sql`, `0002_etapa2.sql`, `0003_duplicate_canonical.sql`, `0004_followup_atomic.sql`, `0005_followup_rpc_json.sql`, `0006_etapa3_clients.sql`, `0007_lead_maps_url.sql`.
- Dependências externas deste plano: `0008_etapa3_projects.sql` e `0009_etapa3_finance.sql`, produzidas pelos Planos 2 e 3. Este plano não as recria nem altera.

## Global Constraints

- Escrever somente código e testes definidos neste plano durante a execução futura.
- Não criar Etapa 4, não implementar relatórios e não alterar `0001`–`0009`.
- Não usar APIs pagas, service role, backend adicional, upload de backup para terceiros, push, deploy ou SQL remoto.
- Dinheiro novo usa centavos seguros no TypeScript e `numeric(14,2)` no PostgreSQL. `service_prices` legado continua em reais na UI e é convertido explicitamente para `referenceValueCents`.
- Datas de agrupamento usam `America/Sao_Paulo`, início inclusivo e fim exclusivo.
- RLS é a autoridade final. RPCs sensíveis são `security definer`, com `search_path = ''`, objetos qualificados e grants mínimos.
- Nenhuma senha, token, chave, service role, sessão ou credencial entra no pacote.
- TDD RED/GREEN e commits frequentes. Não pular testes com `--passWithNoTests`. Build/lint somente depois que todas as tasks criarem seus arquivos; o gate final está na Task 12, após as tasks de implementação e documentação.
- Auditoria é runtime, não tempo de compilação: `0011` e `0012` podem ser aplicadas antes de `0013`, mas RPCs que auditam e restore só podem ser executados ou declarados testados após `0013`. O preflight verifica a writer; sem isso, SQL/RLS é classificado como dependente de configuração externa.
- Restore e diagnóstico são read-only fora da confirmação explícita; nenhuma correção automática, exclusão ou sobrescrita é permitida. Backup é local, sem promessa de armazenamento ou disponibilidade ilimitados.
- Testes SQL sintéticos com dois proprietários são classificados como dependentes de configuração externa quando não executados.

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/types/settings.ts` | Ampliar com `UserPreferences`, defaults e `preferences` em `UserSettings`. |
| `src/lib/preferences.ts` | Criar validação/normalização pura e conversão de preços legados. |
| `src/lib/preferences.test.ts` | Criar testes de limites, códigos canônicos e conversão monetária. |
| `supabase/migrations/0011_etapa3_settings.sql` | Criar preferences, validação, RPCs, categorias de receita e categoria de tarefa. |
| `supabase/tests/etapa3_settings.sql` | Criar testes de validação, RPC, categorias e tarefas. |
| `src/services/settingsService.ts` | Preservar assinaturas atuais e adicionar salvamento atômico/recalculação. |
| `src/services/settingsService.test.ts` | Ampliar cobertura de settings/preferences/RPC. |
| `src/pages/SettingsPage.tsx` | Adicionar todas as seções e salvamento atômico. |
| `src/pages/SettingsPage.test.tsx` | Atualizar fixtures e cobrir seções/validação. |
| `src/types/finance.ts` | Adicionar categoria de receita sem quebrar `PaymentInput`. |
| `src/types/project.ts` | Adicionar categoria persistida/editável em tarefas. |
| `src/services/contractService.ts` | Enviar categoria de receita opcional. |
| `src/services/projectTaskService.ts` | Enviar categoria textual opcional. |
| `src/components/finance/PaymentDialog.tsx` | Selecionar categoria de receita ativa. |
| `src/components/projects/ProjectTaskList.tsx` | Editar/exibir categoria textual. |
| `src/components/preferences/PreferencesProvider.tsx` | Criar contexto opcional de preferências. |
| `src/components/preferences/OpportunityRecalculationCard.tsx` | Criar prévia e confirmação explícita de recálculo. |
| `src/routes/AppRoutes.tsx` | Envolver o layout no provider na Task 5 e registrar `/backup` somente na Task 10, após criar a página. |
| `src/layouts/AppLayout.tsx` | Aplicar densidade e link Backup. |
| `src/components/ui/StatusBadge.tsx` | Consumir rótulo comercial personalizado. |
| `src/components/pipeline/KanbanColumn.tsx` | Consumir rótulo/ordem comercial. |
| `src/components/opportunities/OpportunityCard.tsx` | Consumir rótulos de necessidades. |
| `src/pages/LeadsPage.tsx` | Consumir ordenação e itens por página salvos. |
| `src/lib/opportunity.ts` | Aceitar thresholds opcionais sem alterar defaults atuais. |
| `src/types/backup.ts` | Criar contratos de manifesto, pacote, preview e diagnóstico. |
| `src/lib/backupFormat.ts` | Criar CSV BOM/`;`, proteção de fórmula, ZIP e hashes. |
| `src/lib/backupFormat.test.ts` | Criar testes de formato, limites e credenciais. |
| `src/services/backupService.ts` | Criar exportação paginada, preview, restore e diagnóstico. |
| `src/services/backupService.test.ts` | Criar testes de contrato/RPC/isolamento. |
| `supabase/migrations/0012_etapa3_backup.sql` | Criar registry, staging, preview, restore e diagnóstico. |
| `supabase/tests/etapa3_backup.sql` | Criar testes de conflitos, idênticos, relações, limites e rollback. |
| `src/pages/BackupPage.tsx` | Criar exportação, importação, prévia, confirmação e diagnóstico. |
| `src/pages/BackupPage.test.tsx` | Criar testes de jornada e estados. |
| `src/routes/AppRoutes.test.tsx` | Cobrir rota lazy de Backup. |
| `README.md` | Atualizar instalação, limites e ordem das migrations. |
| `docs/supabase-schema.md` | Atualizar tabelas, RPCs, RLS, auditoria e restore. |

## Contratos produzidos

```ts
export interface UserPreferences {
  version: 1
  company: {
    name: string
    niches: string[]
    services: Array<{
      code: string
      label: string
      defaultDays: number
      referenceValueCents: number | null
    }>
    paymentMethods: string[]
    commercialNotes: string
  }
  commercial: {
    statusLabels: Record<string, string>
    statusOrder: string[]
    defaultStatus: string
    followupIntervalsDays: number[]
    scoringThresholds: { veryHigh: number; high: number; medium: number }
  }
  opportunities: { needLabels: Record<string, string> }
  projects: {
    statusLabels: Record<string, string>
    taskCategories: string[]
    checklistTemplates: Array<{ name: string; items: string[] }>
    priorities: string[]
  }
  finance: { paymentMethods: string[]; display: 'compact' | 'comfortable' }
  ui: {
    density: 'compact' | 'comfortable'
    itemsPerPage: number
    defaultLeadSort: string
  }
}
```

```ts
export interface BackupManifest {
  format: 'ber-crm-backup'
  version: 1
  createdAt: string
  ownerId: string
  files: Array<{ name: string; rows: number; sha256: string; columns: string[] }>
  totalRows: number
}

export interface BackupPackage {
  manifest: BackupManifest
  tables: Record<string, Array<Record<string, unknown>>>
  csvText: Record<string, string>
}

export interface RestorePreview {
  previewId: string
  packageHash: string
  canRestore: boolean
  totals: { new: number; identical: number; conflict: number }
  tables: Array<{ table: string; new: number; identical: number; conflict: number }>
  issues: string[]
}
```

RPCs:

```text
save_user_settings(jsonb) returns jsonb
save_configuration(text,jsonb) returns jsonb
create_revenue_category(text) returns jsonb
archive_revenue_category(uuid) returns jsonb
preview_opportunity_recalculation(jsonb) returns jsonb
recalculate_opportunity_priorities(jsonb,text) returns jsonb
preview_backup_restore(jsonb) returns jsonb
restore_backup(jsonb,text,text) returns jsonb
get_backup_diagnostics() returns jsonb
```

---

### Task 1: Preflight de dependências e contratos

**Files:** nenhuma alteração.

**Interfaces consumidas:** migrations `0008`/`0009`, tipos e RPCs dos Planos 1–3 e, em runtime após `0013`, `public.audit_events` e `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid`.

**Interfaces produced:** nenhuma; esta task apenas registra o preflight e não gera commit vazio.

- [ ] **Step 1: Confirmar que os pré-requisitos existem**

```bash
test -f supabase/migrations/0008_etapa3_projects.sql
test -f supabase/migrations/0009_etapa3_finance.sql
test -f src/types/finance.ts
test -f src/services/contractService.ts
test -f src/services/projectTaskService.ts
git status --short
```

Esperado: os cinco testes de arquivo retornam 0. Se algum falhar, pare: execute os Planos 1–3 antes deste plano. Não copie schemas dos planos para substituir dependências.

- [ ] **Step 2: Confirmar assinaturas consumidas**

```bash
git grep -n "create or replace function public.record_payment" -- supabase/migrations/0009_etapa3_finance.sql
git grep -n "create or replace function public.reorder_project_tasks" -- supabase/migrations/0008_etapa3_projects.sql
git grep -n "export interface ProjectTaskWrite" -- src/types/project.ts
git grep -n "export interface PaymentInput" -- src/types/finance.ts
```

Esperado: uma ocorrência de cada. Se a assinatura divergir, adapte somente os pontos indicados neste plano e registre a divergência no commit; não altere o comportamento financeiro ou de tarefas.

- [ ] **Step 3: Verificar a dependência runtime da auditoria canônica**

```sql
select
  pg_catalog.to_regclass('public.audit_events') as audit_table,
  pg_catalog.to_regprocedure('public.write_audit_event(uuid,uuid,text,text,text,jsonb)') as audit_writer;
```

Esperado antes de `0013`: ambos `NULL`. Nesse estado, execute somente as partes de `0011`/`0012` que não auditam nem restauram e classifique SQL/RLS runtime como pendente de configuração externa; não declare RED/GREEN aprovado. Depois de aplicar `0011` → `0012` → `0013`, a tabela e a assinatura exata devem existir; somente então execute settings auditado, recálculo auditado, restore e seus testes. Não crie função, tabela ou trigger de auditoria neste plano.

- [ ] **Step 4: Confirmar working tree limpo e encerrar sem commit**

```bash
git status --short
git diff --check
```

Esperado: nenhuma alteração produzida por esta task. Se o working tree já contiver alterações autorizadas de outra task, não as descarte nem as commite aqui. Registre o preflight no relatório da task; não execute `git add` nem `git commit`, evitando commit vazio. O formato RED/GREEN não se aplica a uma task que não altera arquivos.

---

### Task 2: Criar tipos e validação pura de preferências

**Files:**

- Modify: `src/types/settings.ts`
- Create: `src/lib/preferences.ts`
- Create: `src/lib/preferences.test.ts`

**Interfaces produced:** `UserPreferences`, `DEFAULT_PREFERENCES`, `validatePreferences`, `applyServicePriceReferences`.

- [ ] **Step 1: Escrever testes RED**

```ts
// src/lib/preferences.test.ts
import { describe, expect, it } from 'vitest'
import { LEAD_STATUSES, NEEDS, NICHES } from '../types/lead'
import { PROJECT_STATUSES } from '../types/project'
import { DEFAULT_PREFERENCES, type UserPreferences } from '../types/settings'
import { applyServicePriceReferences, validatePreferences } from './preferences'

function valid(): UserPreferences {
  return structuredClone(DEFAULT_PREFERENCES)
}

describe('validatePreferences', () => {
  it('aceita o default canônico e preserva a versão 1', () => {
    expect(validatePreferences(valid())).toEqual({ ok: true, value: valid() })
  })

  it('rejeita versão, códigos de status e ordem duplicada', () => {
    const wrongVersion = { ...valid(), version: 2 }
    expect(validatePreferences(wrongVersion).ok).toBe(false)

    const unknownStatus = valid()
    unknownStatus.commercial.statusOrder = [...LEAD_STATUSES, 'inventado']
    expect(validatePreferences(unknownStatus).ok).toBe(false)

    const duplicate = valid()
    duplicate.commercial.statusOrder[1] = duplicate.commercial.statusOrder[0]
    expect(validatePreferences(duplicate).ok).toBe(false)
  })

  it('exige conjuntos exatos de rótulos e códigos canônicos', () => {
    const labels = valid()
    delete labels.opportunities.needLabels.site
    expect(validatePreferences(labels).ok).toBe(false)

    const niches = valid()
    niches.company.niches = ['inventado']
    expect(validatePreferences(niches).ok).toBe(false)

    expect(LEAD_STATUSES.every((status) => status in valid().commercial.statusLabels)).toBe(true)
    expect(PROJECT_STATUSES.every((status) => status in valid().projects.statusLabels)).toBe(true)
    expect(NEEDS.every((need) => need in valid().opportunities.needLabels)).toBe(true)
    expect(NICHES.every((niche) => valid().company.niches.includes(niche))).toBe(true)
  })

  it('rejeita thresholds não decrescentes e limites inválidos', () => {
    const thresholds = valid()
    thresholds.commercial.scoringThresholds = { veryHigh: 50, high: 60, medium: 40 }
    expect(validatePreferences(thresholds).ok).toBe(false)

    const ui = valid()
    ui.ui.itemsPerPage = 15
    expect(validatePreferences(ui).ok).toBe(false)

    const money = valid()
    money.company.services[0].referenceValueCents = -1
    expect(validatePreferences(money).ok).toBe(false)
  })

  it('rejeita códigos de cliente/projeto, rótulo vazio ou duplicado, ordem incompleta e default inválido no domínio comercial', () => {
    const clientCode = valid()
    clientCode.commercial.statusLabels.active = 'Ativo'
    expect(validatePreferences(clientCode).ok).toBe(false)

    const projectCode = valid()
    projectCode.commercial.statusLabels.planning = 'Planejamento'
    expect(validatePreferences(projectCode).ok).toBe(false)

    const empty = valid()
    empty.commercial.statusLabels.novo = ''
    expect(validatePreferences(empty).ok).toBe(false)

    const duplicate = valid()
    duplicate.commercial.statusLabels.contato_realizado = duplicate.commercial.statusLabels.novo
    expect(validatePreferences(duplicate).ok).toBe(false)

    const incomplete = valid()
    incomplete.commercial.statusOrder = incomplete.commercial.statusOrder.slice(1)
    expect(validatePreferences(incomplete).ok).toBe(false)

    const invalidDefault = valid()
    invalidDefault.commercial.defaultStatus = 'active'
    expect(validatePreferences(invalidDefault).ok).toBe(false)
  })

  it('rejeita chaves extras e categorias de tarefa vazias', () => {
    const extra = { ...valid(), admin: true }
    expect(validatePreferences(extra).ok).toBe(false)

    const categories = valid()
    categories.projects.taskCategories = ['Design', 'Design']
    expect(validatePreferences(categories).ok).toBe(false)
  })
})

describe('applyServicePriceReferences', () => {
  it('converte cada serviço pelo próprio valor e preserva null, zero e decimais', () => {
    const result = applyServicePriceReferences(valid(), {
      site: 1200.5, landing: 750, cardapio: null, catalogo: 0, outros: 300,
    })
    expect(result.company.services.find((service) => service.code === 'site')?.referenceValueCents)
      .toBe(120050)
    expect(result.company.services.find((service) => service.code === 'landing')?.referenceValueCents)
      .toBe(75000)
    expect(result.company.services.find((service) => service.code === 'cardapio')?.referenceValueCents)
      .toBeNull()
    expect(result.company.services.find((service) => service.code === 'catalogo')?.referenceValueCents)
      .toBe(0)
  })

  it('rejeita preço com mais de duas casas ou fora do limite', () => {
    expect(() => applyServicePriceReferences(valid(), {
      site: 1.001, landing: 0, cardapio: 0, catalogo: 0, outros: 0,
    })).toThrow('Preço de serviço inválido.')
  })
})
```

Comando RED:

```bash
npm test -- src/lib/preferences.test.ts
```

Esperado: falha porque `DEFAULT_PREFERENCES`, `validatePreferences` e `applyServicePriceReferences` não existem.

- [ ] **Step 2: Substituir `src/types/settings.ts`**

```ts
import { LEAD_STATUSES, NEEDS, NICHES } from './lead'
import { PROJECT_STATUSES } from './project'

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

export interface UserPreferences {
  version: 1
  company: {
    name: string
    niches: string[]
    services: Array<{
      code: string
      label: string
      defaultDays: number
      referenceValueCents: number | null
    }>
    paymentMethods: string[]
    commercialNotes: string
  }
  commercial: {
    statusLabels: Record<string, string>
    statusOrder: string[]
    defaultStatus: string
    followupIntervalsDays: number[]
    scoringThresholds: { veryHigh: number; high: number; medium: number }
  }
  opportunities: { needLabels: Record<string, string> }
  projects: {
    statusLabels: Record<string, string>
    taskCategories: string[]
    checklistTemplates: Array<{ name: string; items: string[] }>
    priorities: string[]
  }
  finance: { paymentMethods: string[]; display: 'compact' | 'comfortable' }
  ui: {
    density: 'compact' | 'comfortable'
    itemsPerPage: number
    defaultLeadSort: string
  }
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: 1,
  company: {
    name: '',
    niches: [...NICHES],
    services: [
      { code: 'site', label: 'Site', defaultDays: 15, referenceValueCents: null },
      { code: 'landing', label: 'Landing page', defaultDays: 7, referenceValueCents: null },
      { code: 'cardapio', label: 'Cardápio digital', defaultDays: 10, referenceValueCents: null },
      { code: 'catalogo', label: 'Catálogo digital', defaultDays: 10, referenceValueCents: null },
      { code: 'outros', label: 'Outros serviços', defaultDays: 15, referenceValueCents: null },
    ],
    paymentMethods: ['pix', 'cartao', 'boleto', 'transferencia'],
    commercialNotes: '',
  },
  commercial: {
    statusLabels: {
      novo: 'Novo', contato_realizado: 'Contato realizado', aguardando_resposta: 'Aguardando resposta',
      pediu_informacoes: 'Pediu informações', interessado: 'Interessado', negociando: 'Negociando',
      aceitou: 'Aceitou', ignorou: 'Ignorou', nao_interessado: 'Não interessado',
      follow_up: 'Follow-up', perdido: 'Perdido',
    },
    statusOrder: [...LEAD_STATUSES],
    defaultStatus: 'novo',
    followupIntervalsDays: [1, 3, 7, 15],
    scoringThresholds: { veryHigh: 80, high: 60, medium: 40 },
  },
  opportunities: {
    needLabels: {
      site: 'Precisa de site', cardapio: 'Precisa de cardápio digital',
      landing: 'Precisa de landing page', catalogo: 'Precisa de catálogo digital',
      presenca: 'Precisa melhorar presença digital',
    },
  },
  projects: {
    statusLabels: {
      not_started: 'Não iniciado', planning: 'Planejamento', in_development: 'Em desenvolvimento',
      awaiting_client_info: 'Aguardando cliente', in_review: 'Em revisão',
      awaiting_approval: 'Aguardando aprovação', changes_requested: 'Alterações solicitadas',
      completed: 'Concluído', delivered: 'Entregue', cancelled: 'Cancelado',
    },
    taskCategories: ['Design', 'Conteúdo', 'Desenvolvimento', 'Revisão', 'Entrega'],
    checklistTemplates: [
      { name: 'Site', items: ['Briefing', 'Conteúdo', 'Layout', 'Homologação'] },
    ],
    priorities: ['very_high', 'high', 'medium', 'low'],
  },
  finance: { paymentMethods: ['pix', 'cartao', 'boleto', 'transferencia'], display: 'comfortable' },
  ui: { density: 'comfortable', itemsPerPage: 20, defaultLeadSort: 'created_desc' },
}

export interface UserSettings {
  owner_id: string
  service_prices: ServicePrices
  whatsapp_template: string
  preferences: UserPreferences
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'owner_id'> = {
  service_prices: { site: 0, landing: 0, cardapio: 0, catalogo: 0, outros: 0 },
  whatsapp_template: '',
  preferences: structuredClone(DEFAULT_PREFERENCES),
}

export const CANONICAL_LEAD_STATUSES = LEAD_STATUSES
```

- [ ] **Step 3: Criar `src/lib/preferences.ts`**

```ts
import { MAX_MONEY_CENTS, parseMoneyInput } from './money'
import { LEAD_STATUSES, NEEDS, NICHES } from '../types/lead'
import { PROJECT_STATUSES } from '../types/project'
import {
  DEFAULT_PREFERENCES, SERVICE_LABELS,
  type ServicePrices, type UserPreferences,
} from '../types/settings'

export type PreferencesValidation =
  | { ok: true; value: UserPreferences }
  | { ok: false; errors: string[] }

const SERVICE_CODES = Object.keys(SERVICE_LABELS)
const LEAD_SORTS = ['created_desc', 'created_asc', 'score_desc', 'score_asc']
const PROJECT_PRIORITIES = ['very_high', 'high', 'medium', 'low']
const PAGE_SIZES = [10, 20, 50, 100]

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return object(value) && onlyKeys(value, keys)
}

function text(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0)
}

function uniqueTexts(value: unknown, maxItems: number, maxLength: number, allowEmpty = false): value is string[] {
  if (!Array.isArray(value) || value.length > maxItems) return false
  if (!allowEmpty && value.length === 0) return false
  if (!value.every((item) => text(item, maxLength))) return false
  const normalized = value.map((item) => item.trim().toLocaleLowerCase('pt-BR'))
  return new Set(normalized).size === normalized.length
}

function exactSet(value: unknown, allowed: readonly string[]): value is string[] {
  return uniqueTexts(value, allowed.length, 80)
    && value.length === allowed.length
    && allowed.every((item) => value.includes(item))
}

function labels(value: unknown, allowed: readonly string[]): value is Record<string, string> {
  if (!exactKeys(value, allowed)) return false
  const normalized = allowed.map((key) => String(value[key]).trim().toLocaleLowerCase('pt-BR'))
  return allowed.every((key) => text(value[key], 60))
    && new Set(normalized).size === normalized.length
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function paymentMethods(value: unknown): value is string[] {
  return uniqueTexts(value, 12, 40)
}

export function validatePreferences(input: unknown): PreferencesValidation {
  const errors: string[] = []
  if (!object(input)) return { ok: false, errors: ['Preferências inválidas.'] }
  if (!onlyKeys(input, ['version','company','commercial','opportunities','projects','finance','ui'])) {
    errors.push('Há campos desconhecidos nas preferências.')
  }
  if (input.version !== 1) errors.push('A versão das preferências deve ser 1.')

  const company = input.company
  if (exactKeys(company, ['name','niches','services','paymentMethods','commercialNotes'])) {
    if (!text(company.name, 120, true)) errors.push('Nome da empresa inválido.')
    if (!exactSet(company.niches, NICHES)) errors.push('Nichos devem usar a lista canônica.')
    if (!paymentMethods(company.paymentMethods)) errors.push('Formas de pagamento inválidas.')
    if (!text(company.commercialNotes, 2000, true)) errors.push('Notas comerciais inválidas.')
    if (Array.isArray(company.services) && company.services.length > 0 && company.services.length <= 20) {
      const codes = company.services.map((service) => object(service) ? service.code : null)
      if (new Set(codes).size !== codes.length || codes.some((code) => !SERVICE_CODES.includes(String(code)))) {
        errors.push('Códigos de serviço inválidos ou duplicados.')
      }
      for (const service of company.services) {
        if (!exactKeys(service, ['code','label','defaultDays','referenceValueCents'])) {
          errors.push('Serviço com campos inválidos.')
          continue
        }
        if (!text(service.label, 60)) errors.push('Rótulo de serviço inválido.')
        if (!integer(service.defaultDays, 1, 365)) errors.push('Prazo padrão inválido.')
        if (service.referenceValueCents !== null
          && !integer(service.referenceValueCents, 0, MAX_MONEY_CENTS)) {
          errors.push('Valor de referência inválido.')
        }
      }
    } else errors.push('Lista de serviços inválida.')
  } else errors.push('Seção company inválida.')

  const commercial = input.commercial
  if (exactKeys(commercial, ['statusLabels','statusOrder','defaultStatus','followupIntervalsDays','scoringThresholds'])) {
    if (!labels(commercial.statusLabels, LEAD_STATUSES)) errors.push('Rótulos de status comercial inválidos.')
    if (!exactSet(commercial.statusOrder, LEAD_STATUSES)) errors.push('Ordem de status comercial inválida.')
    if (typeof commercial.defaultStatus !== 'string' || !LEAD_STATUSES.includes(commercial.defaultStatus as never)) {
      errors.push('Status padrão inválido.')
    }
    if (!Array.isArray(commercial.followupIntervalsDays)
      || commercial.followupIntervalsDays.length === 0
      || commercial.followupIntervalsDays.length > 10
      || !commercial.followupIntervalsDays.every((day) => integer(day, 1, 365))
      || new Set(commercial.followupIntervalsDays).size !== commercial.followupIntervalsDays.length) {
      errors.push('Intervalos de follow-up inválidos.')
    }
    const thresholds = commercial.scoringThresholds
    if (exactKeys(thresholds, ['veryHigh','high','medium'])
      && integer(thresholds.veryHigh, 1, 100)
      && integer(thresholds.high, 1, 100)
      && integer(thresholds.medium, 0, 100)
      && thresholds.veryHigh > thresholds.high
      && thresholds.high > thresholds.medium) {
      // válido
    } else errors.push('Thresholds devem satisfazer veryHigh > high > medium.')
  } else errors.push('Seção commercial inválida.')

  const opportunities = input.opportunities
  if (exactKeys(opportunities, ['needLabels'])) {
    if (!labels(opportunities.needLabels, NEEDS)) errors.push('Rótulos de necessidades inválidos.')
  } else errors.push('Seção opportunities inválida.')

  const projects = input.projects
  if (exactKeys(projects, ['statusLabels','taskCategories','checklistTemplates','priorities'])) {
    if (!labels(projects.statusLabels, PROJECT_STATUSES)) errors.push('Rótulos de status de projeto inválidos.')
    if (!uniqueTexts(projects.taskCategories, 30, 40, true)) errors.push('Categorias de tarefa inválidas.')
    if (!exactSet(projects.priorities, PROJECT_PRIORITIES)) errors.push('Prioridades inválidas.')
    if (!Array.isArray(projects.checklistTemplates) || projects.checklistTemplates.length > 20) {
      errors.push('Checklists inválidos.')
    } else {
      for (const template of projects.checklistTemplates) {
        if (!exactKeys(template, ['name','items']) || !text(template.name, 80)
          || !uniqueTexts(template.items, 30, 120, true)) errors.push('Checklist inválido.')
      }
    }
  } else errors.push('Seção projects inválida.')

  const finance = input.finance
  if (exactKeys(finance, ['paymentMethods','display'])) {
    if (!paymentMethods(finance.paymentMethods)) errors.push('Formas de pagamento financeiras inválidas.')
    if (finance.display !== 'compact' && finance.display !== 'comfortable') errors.push('Exibição financeira inválida.')
  } else errors.push('Seção finance inválida.')

  const ui = input.ui
  if (exactKeys(ui, ['density','itemsPerPage','defaultLeadSort'])) {
    if (ui.density !== 'compact' && ui.density !== 'comfortable') errors.push('Densidade inválida.')
    if (!integer(ui.itemsPerPage, 10, 100) || !PAGE_SIZES.includes(ui.itemsPerPage)) {
      errors.push('Itens por página inválido.')
    }
    if (typeof ui.defaultLeadSort !== 'string' || !LEAD_SORTS.includes(ui.defaultLeadSort)) {
      errors.push('Ordenação padrão inválida.')
    }
  } else errors.push('Seção ui inválida.')

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: structuredClone(input) as UserPreferences }
}

export type ServicePriceReferences = Partial<Record<keyof ServicePrices, number | null>>

export function applyServicePriceReferences(
  preferences: UserPreferences,
  prices: ServicePriceReferences,
): UserPreferences {
  const next = structuredClone(preferences)
  const centsByCode = new Map<string, number | null>()
  for (const code of SERVICE_CODES) {
    const price = prices[code as keyof ServicePrices]
    if (price === null) {
      centsByCode.set(code, null)
      continue
    }
    if (price === undefined) continue
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      throw new Error('Preço de serviço inválido.')
    }
    const cents = parseMoneyInput(String(price))
    if (cents === null) throw new Error('Preço de serviço inválido.')
    centsByCode.set(code, cents)
  }
  for (const service of next.company.services) {
    if (centsByCode.has(service.code)) {
      service.referenceValueCents = centsByCode.get(service.code) ?? null
    }
  }
  return next
}

export function defaultPreferences(): UserPreferences {
  return structuredClone(DEFAULT_PREFERENCES)
}
```

- [ ] **Step 4: GREEN**

```bash
npm test -- src/lib/preferences.test.ts
```

Esperado: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/types/settings.ts src/lib/preferences.ts src/lib/preferences.test.ts
git commit -m "feat: validar preferencias versionadas no cliente"
```

---

### Task 3: Persistir preferences e salvar perfil/settings atomicamente

**Files:**

- Create: `supabase/migrations/0011_etapa3_settings.sql`
- Create: `supabase/tests/etapa3_settings.sql`
- Modify: `src/services/settingsService.ts`
- Modify: `src/services/settingsService.test.ts`
- Modify: `src/pages/SettingsPage.test.tsx`

**Interfaces produced:** `default_user_preferences()`, `validate_user_preferences(jsonb)`, `save_user_settings(jsonb)`, `save_configuration(text,jsonb)`.

- [ ] **Step 1: Escrever o teste SQL RED**

```sql
-- supabase/tests/etapa3_settings.sql
begin;

do $$
begin
  insert into auth.users (id, email) values
    ('00000000-0000-4000-8000-000000000001', 'etapa3-settings-owner@example.test'),
    ('00000000-0000-4000-8000-000000000002', 'etapa3-settings-other@example.test');
end
$$;

set local role authenticated;

do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-000000000001';
  v_other uuid := '00000000-0000-4000-8000-000000000002';
  v_default jsonb;
  v_payload jsonb;
  v_result jsonb;
  v_name text;
  v_client_id uuid;
  v_contract_id uuid;
  v_project_id uuid;
  v_category_id uuid;
  v_foreign_category_id uuid;
  v_payment_id uuid;
  v_state text;
  v_audit_count int;
begin
  if pg_catalog.to_regprocedure('public.write_audit_event(uuid,uuid,text,text,text,jsonb)') is null then
    raise exception 'Execute 0011 -> 0012 -> 0013 antes deste harness de auditoria runtime.';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_default := public.default_user_preferences();

  v_payload := jsonb_build_object(
    'service_prices', jsonb_build_object('site', 1200.50, 'landing', 750, 'cardapio', null, 'catalogo', 0, 'outros', 0),
    'whatsapp_template', 'Olá!',
    'preferences', v_default
  );
  v_result := public.save_configuration('  Ana Lima  ', v_payload);
  if (v_result ->> 'owner_id') <> v_owner::text then raise exception 'Dono incorreto.'; end if;
  if (v_result ->> 'whatsapp_template') <> 'Olá!' then raise exception 'Template não persistido.'; end if;
  if (v_result -> 'preferences' -> 'company' -> 'services' -> 0 ->> 'referenceValueCents' <> '120050'
    or v_result -> 'preferences' -> 'company' -> 'services' -> 1 ->> 'referenceValueCents' <> '75000'
    or v_result -> 'preferences' -> 'company' -> 'services' -> 2 -> 'referenceValueCents' <> 'null'::jsonb
    or v_result -> 'preferences' -> 'company' -> 'services' -> 3 ->> 'referenceValueCents' <> '0' then
    raise exception 'Conversão de reais para centavos não preservou cada serviço.';
  end if;
  select full_name into v_name from public.profiles where id = v_owner;
  if v_name <> 'Ana Lima' then raise exception 'Nome não foi aparado/persistido.'; end if;
  select count(*) into v_audit_count from public.audit_events
    where owner_id = v_owner and actor_id = v_owner and action = 'settings.updated'
      and entity_type = 'user_settings' and entity_id = v_owner::text
      and metadata = jsonb_build_object('settings_version', 1)::jsonb;
  if v_audit_count <> 1 then raise exception 'Auditoria mínima de settings ausente ou duplicada.'; end if;
  begin
    perform public.save_user_settings(v_payload || jsonb_build_object('whatsapp_template', repeat('x', 4001)));
    raise exception 'Template acima do limite foi aceito.';
  exception when check_violation then null;
  end;

  begin
    perform public.save_user_settings(v_payload || jsonb_build_object(
      'preferences', v_default || jsonb_build_object('version', 2)
    ));
    raise exception 'Versão inválida foi aceita.';
  exception when check_violation then null;
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  if exists (select 1 from public.user_settings where owner_id = v_owner) then
    raise exception 'RLS vazou settings de outro dono.';
  end if;
  begin
    perform public.save_configuration('Outro', v_payload);
    raise exception 'RPC permitiu payload de outro dono.';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;
```

Comando RED:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_settings.sql
```

Esperado: falha porque as funções/coluna de `0011` não existem.

- [ ] **Step 2: Criar `0011_etapa3_settings.sql`**

```sql
-- supabase/migrations/0011_etapa3_settings.sql
begin;

create or replace function public.default_user_preferences()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select '{
    "version":1,
    "company":{
      "name":"",
      "niches":["barbearia","manicure","nail_designer","salao_beleza","restaurante","pizzaria","hamburgueria","lanchonete","cafeteria","clinica_estetica","comercio","outros"],
      "services":[
        {"code":"site","label":"Site","defaultDays":15,"referenceValueCents":null},
        {"code":"landing","label":"Landing page","defaultDays":7,"referenceValueCents":null},
        {"code":"cardapio","label":"Cardápio digital","defaultDays":10,"referenceValueCents":null},
        {"code":"catalogo","label":"Catálogo digital","defaultDays":10,"referenceValueCents":null},
        {"code":"outros","label":"Outros serviços","defaultDays":15,"referenceValueCents":null}
      ],
      "paymentMethods":["pix","cartao","boleto","transferencia"],
      "commercialNotes":""
    },
    "commercial":{
      "statusLabels":{"novo":"Novo","contato_realizado":"Contato realizado","aguardando_resposta":"Aguardando resposta","pediu_informacoes":"Pediu informações","interessado":"Interessado","negociando":"Negociando","aceitou":"Aceitou","ignorou":"Ignorou","nao_interessado":"Não interessado","follow_up":"Follow-up","perdido":"Perdido"},
      "statusOrder":["novo","contato_realizado","aguardando_resposta","pediu_informacoes","interessado","negociando","aceitou","ignorou","nao_interessado","follow_up","perdido"],
      "defaultStatus":"novo",
      "followupIntervalsDays":[1,3,7,15],
      "scoringThresholds":{"veryHigh":80,"high":60,"medium":40}
    },
    "opportunities":{"needLabels":{"site":"Precisa de site","cardapio":"Precisa de cardápio digital","landing":"Precisa de landing page","catalogo":"Precisa de catálogo digital","presenca":"Precisa melhorar presença digital"}},
    "projects":{
      "statusLabels":{"not_started":"Não iniciado","planning":"Planejamento","in_development":"Em desenvolvimento","awaiting_client_info":"Aguardando cliente","in_review":"Em revisão","awaiting_approval":"Aguardando aprovação","changes_requested":"Alterações solicitadas","completed":"Concluído","delivered":"Entregue","cancelled":"Cancelado"},
      "taskCategories":["Design","Conteúdo","Desenvolvimento","Revisão","Entrega"],
      "checklistTemplates":[{"name":"Site","items":["Briefing","Conteúdo","Layout","Homologação"]}],
      "priorities":["very_high","high","medium","low"]
    },
    "finance":{"paymentMethods":["pix","cartao","boleto","transferencia"],"display":"comfortable"},
    "ui":{"density":"comfortable","itemsPerPage":20,"defaultLeadSort":"created_desc"}
  }'::jsonb;
$$;

revoke all on function public.default_user_preferences() from public, anon;
grant execute on function public.default_user_preferences() to authenticated;

create or replace function public.jsonb_object_has_exact_keys(p_value jsonb, p_keys text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
    and pg_catalog.cardinality(p_keys) = (select count(*) from jsonb_object_keys(p_value))
    and not exists (
      select 1 from unnest(p_keys) as expected(key)
      where not (p_value ? expected.key)
    );
$$;

create or replace function public.jsonb_array_has_exact_texts(p_value jsonb, p_allowed text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
    and pg_catalog.cardinality(p_allowed) = jsonb_array_length(p_value)
    and not exists (
      select 1 from jsonb_array_elements_text(p_value) as item(value)
      where not (item.value = any(p_allowed))
    )
    and (select count(distinct value) from jsonb_array_elements_text(p_value) as item(value)) = jsonb_array_length(p_value);
$$;

create or replace function public.jsonb_labels_valid(p_value jsonb, p_keys text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select public.jsonb_object_has_exact_keys(p_value, p_keys)
    and not exists (
      select 1 from unnest(p_keys) as expected(key)
      where jsonb_typeof(p_value -> expected.key) <> 'string'
        or length(pg_catalog.btrim(p_value ->> expected.key)) not between 1 and 60
    )
    and (select count(distinct lower(pg_catalog.btrim(value #>> '{}')))
      from jsonb_each(p_value) as item(key, value)) = pg_catalog.cardinality(p_keys);
$$;

create or replace function public.jsonb_text_array_valid(p_value jsonb, p_max int, p_max_length int, p_allow_empty boolean)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
    and jsonb_array_length(p_value) <= p_max
    and (p_allow_empty or jsonb_array_length(p_value) > 0)
    and not exists (
      select 1 from jsonb_array_elements(p_value) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or length(pg_catalog.btrim(item.value #>> '{}')) not between 1 and p_max_length
    )
    and (select count(distinct lower(pg_catalog.btrim(value #>> '{}')))
      from jsonb_array_elements(p_value) as item(value)) = jsonb_array_length(p_value);
$$;

create or replace function public.jsonb_int_in_range(p_value jsonb, p_key text, p_min int, p_max int)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value -> p_key) = 'number'
    and (p_value ->> p_key) ~ '^-?[0-9]+$'
    and (p_value ->> p_key)::numeric between p_min and p_max;
$$;

create or replace function public.jsonb_int_array_valid(p_value jsonb, p_min int, p_max int)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
    and jsonb_array_length(p_value) between 1 and 10
    and not exists (
      select 1 from jsonb_array_elements(p_value) as item(value)
      where case
        when jsonb_typeof(item.value) = 'number' and (item.value #>> '{}') ~ '^[0-9]+$'
          then (item.value #>> '{}')::numeric not between p_min and p_max
        else true end
    )
    and (select count(distinct value #>> '{}') from jsonb_array_elements(p_value) as item(value))
      = jsonb_array_length(p_value);
$$;

create or replace function public.validate_user_preferences(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_company jsonb;
  v_commercial jsonb;
  v_projects jsonb;
  v_service jsonb;
  v_template jsonb;
  v_thresholds jsonb;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object'
    or p_value -> 'version' <> '1'::jsonb
    or not public.jsonb_object_has_exact_keys(p_value, array['version','company','commercial','opportunities','projects','finance','ui']) then
    return false;
  end if;
  if not public.jsonb_object_has_exact_keys(p_value -> 'opportunities', array['needLabels'])
    or not public.jsonb_labels_valid(p_value -> 'opportunities' -> 'needLabels',
      array['site','cardapio','landing','catalogo','presenca']) then return false;
  end if;
  if not public.jsonb_object_has_exact_keys(p_value -> 'finance', array['paymentMethods','display'])
    or p_value -> 'finance' ->> 'display' not in ('compact','comfortable')
    or not public.jsonb_text_array_valid(p_value -> 'finance' -> 'paymentMethods', 12, 40, false) then return false;
  end if;
  if not public.jsonb_object_has_exact_keys(p_value -> 'ui', array['density','itemsPerPage','defaultLeadSort'])
    or p_value -> 'ui' ->> 'density' not in ('compact','comfortable')
    or not public.jsonb_int_in_range(p_value -> 'ui', 'itemsPerPage', 10, 100)
    or (p_value -> 'ui' ->> 'itemsPerPage') not in ('10','20','50','100')
    or p_value -> 'ui' ->> 'defaultLeadSort' not in ('created_desc','created_asc','score_desc','score_asc') then return false;
  end if;

  v_company := p_value -> 'company';
  if not public.jsonb_object_has_exact_keys(v_company, array['name','niches','services','paymentMethods','commercialNotes'])
    or jsonb_typeof(v_company -> 'name') <> 'string'
    or length(v_company ->> 'name') > 120
    or jsonb_typeof(v_company -> 'commercialNotes') <> 'string'
    or length(v_company ->> 'commercialNotes') > 2000
    or not public.jsonb_array_has_exact_texts(v_company -> 'niches', array[
      'barbearia','manicure','nail_designer','salao_beleza','restaurante','pizzaria','hamburgueria',
      'lanchonete','cafeteria','clinica_estetica','comercio','outros'
    ])
    or not public.jsonb_text_array_valid(v_company -> 'paymentMethods', 12, 40, false) then return false;
  end if;
  if jsonb_typeof(v_company -> 'services') <> 'array'
    or jsonb_array_length(v_company -> 'services') not between 1 and 20 then return false;
  end if;
  for v_service in select value from jsonb_array_elements(v_company -> 'services') loop
    if not public.jsonb_object_has_exact_keys(v_service, array['code','label','defaultDays','referenceValueCents'])
      or jsonb_typeof(v_service -> 'code') <> 'string'
      or v_service ->> 'code' not in ('site','landing','cardapio','catalogo','outros')
      or jsonb_typeof(v_service -> 'label') <> 'string'
      or length(pg_catalog.btrim(v_service ->> 'label')) not between 1 and 60
      or not public.jsonb_int_in_range(v_service, 'defaultDays', 1, 365)
      or case
        when v_service -> 'referenceValueCents' = 'null'::jsonb then false
        when jsonb_typeof(v_service -> 'referenceValueCents') = 'number'
          and (v_service ->> 'referenceValueCents') ~ '^[0-9]+$'
          then (v_service ->> 'referenceValueCents')::numeric > 99999999999999
        else true end then return false;
    end if;
  end loop;
  if (select count(distinct value ->> 'code') from jsonb_array_elements(v_company -> 'services') as item(value))
    <> jsonb_array_length(v_company -> 'services') then return false;
  end if;

  v_commercial := p_value -> 'commercial';
  if not public.jsonb_object_has_exact_keys(v_commercial, array['statusLabels','statusOrder','defaultStatus','followupIntervalsDays','scoringThresholds'])
    or not public.jsonb_labels_valid(v_commercial -> 'statusLabels', array[
      'novo','contato_realizado','aguardando_resposta','pediu_informacoes','interessado','negociando',
      'aceitou','ignorou','nao_interessado','follow_up','perdido'
    ])
    or not public.jsonb_array_has_exact_texts(v_commercial -> 'statusOrder', array[
      'novo','contato_realizado','aguardando_resposta','pediu_informacoes','interessado','negociando',
      'aceitou','ignorou','nao_interessado','follow_up','perdido'
    ])
    or v_commercial ->> 'defaultStatus' not in (
      'novo','contato_realizado','aguardando_resposta','pediu_informacoes','interessado','negociando',
      'aceitou','ignorou','nao_interessado','follow_up','perdido'
    )
    or not public.jsonb_int_array_valid(v_commercial -> 'followupIntervalsDays', 1, 365) then return false;
  end if;
  v_thresholds := v_commercial -> 'scoringThresholds';
  if not public.jsonb_object_has_exact_keys(v_thresholds, array['veryHigh','high','medium'])
    or not public.jsonb_int_in_range(v_thresholds, 'veryHigh', 1, 100)
    or not public.jsonb_int_in_range(v_thresholds, 'high', 1, 100)
    or not public.jsonb_int_in_range(v_thresholds, 'medium', 0, 100) then return false;
  end if;
  if (v_thresholds ->> 'veryHigh')::int <= (v_thresholds ->> 'high')::int
    or (v_thresholds ->> 'high')::int <= (v_thresholds ->> 'medium')::int then return false;
  end if;

  v_projects := p_value -> 'projects';
  if not public.jsonb_object_has_exact_keys(v_projects, array['statusLabels','taskCategories','checklistTemplates','priorities'])
    or not public.jsonb_labels_valid(v_projects -> 'statusLabels', array[
      'not_started','planning','in_development','awaiting_client_info','in_review','awaiting_approval',
      'changes_requested','completed','delivered','cancelled'
    ])
    or not public.jsonb_array_has_exact_texts(v_projects -> 'priorities', array['very_high','high','medium','low'])
    or not public.jsonb_text_array_valid(v_projects -> 'taskCategories', 30, 40, true)
    or jsonb_typeof(v_projects -> 'checklistTemplates') <> 'array'
    or jsonb_array_length(v_projects -> 'checklistTemplates') > 20 then return false;
  end if;
  for v_template in select value from jsonb_array_elements(v_projects -> 'checklistTemplates') loop
    if not public.jsonb_object_has_exact_keys(v_template, array['name','items'])
      or jsonb_typeof(v_template -> 'name') <> 'string'
      or length(pg_catalog.btrim(v_template ->> 'name')) not between 1 and 80
      or not public.jsonb_text_array_valid(v_template -> 'items', 30, 120, true) then return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.jsonb_object_has_exact_keys(jsonb,text[]) from public, anon, authenticated;
revoke all on function public.jsonb_array_has_exact_texts(jsonb,text[]) from public, anon, authenticated;
revoke all on function public.jsonb_labels_valid(jsonb,text[]) from public, anon, authenticated;
revoke all on function public.jsonb_text_array_valid(jsonb,int,int,boolean) from public, anon, authenticated;
revoke all on function public.jsonb_int_in_range(jsonb,text,int,int) from public, anon, authenticated;
revoke all on function public.jsonb_int_array_valid(jsonb,int,int) from public, anon, authenticated;
create or replace function public.backup_preferences_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return public.validate_user_preferences(p_value);
exception when others then
  return false;
end;
$$;

revoke all on function public.validate_user_preferences(jsonb) from public, anon, authenticated;
grant execute on function public.jsonb_object_has_exact_keys(jsonb,text[]) to authenticated;
grant execute on function public.jsonb_array_has_exact_texts(jsonb,text[]) to authenticated;
grant execute on function public.jsonb_labels_valid(jsonb,text[]) to authenticated;
grant execute on function public.jsonb_text_array_valid(jsonb,int,int,boolean) to authenticated;
grant execute on function public.jsonb_int_in_range(jsonb,text,int,int) to authenticated;
grant execute on function public.jsonb_int_array_valid(jsonb,int,int) to authenticated;
grant execute on function public.validate_user_preferences(jsonb) to authenticated;
revoke all on function public.backup_preferences_valid(jsonb) from public, anon, authenticated;
grant execute on function public.backup_preferences_valid(jsonb) to authenticated;

alter table public.user_settings
  add column if not exists preferences jsonb not null default public.default_user_preferences();

alter table public.user_settings
  add constraint user_settings_preferences_check check (public.validate_user_preferences(preferences));

create or replace function public.valid_service_prices(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_key text;
begin
  if jsonb_typeof(p_value) <> 'object'
    or not public.jsonb_object_has_exact_keys(p_value, array['site','landing','cardapio','catalogo','outros']) then
    return false;
  end if;
  for v_key in select jsonb_object_keys(p_value) loop
    if p_value -> v_key = 'null'::jsonb then continue; end if;
    if (p_value ->> v_key) !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
      or (p_value ->> v_key)::numeric > 999999999999.99 then return false;
  end loop;
  return true;
end;
$$;

revoke all on function public.valid_service_prices(jsonb) from public, anon, authenticated;
alter table public.user_settings
  add constraint user_settings_service_prices_check check (public.valid_service_prices(service_prices));

alter table public.user_settings
  add constraint user_settings_whatsapp_length_check check (length(whatsapp_template) <= 4000);

create or replace function public.validated_settings_payload(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prices jsonb;
  v_preferences jsonb;
  v_key text;
  v_index integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or not public.jsonb_object_has_exact_keys(p_payload, array['service_prices','whatsapp_template','preferences']) then
    raise exception 'Configurações inválidas.' using errcode = '22023';
  end if;
  v_prices := p_payload -> 'service_prices';
  v_preferences := p_payload -> 'preferences';
  if jsonb_typeof(v_prices) <> 'object'
    or not public.jsonb_object_has_exact_keys(v_prices, array['site','landing','cardapio','catalogo','outros']) then
    raise exception 'Preços de serviço inválidos.' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(v_prices) loop
    if v_prices -> v_key = 'null'::jsonb then continue; end if;
    if (v_prices ->> v_key) !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
      or (v_prices ->> v_key)::numeric > 999999999999.99 then
      raise exception 'Preços de serviço inválidos.' using errcode = '22023';
    end if;
  end loop;
  if length(p_payload ->> 'whatsapp_template') > 4000 then
    raise exception 'Template do WhatsApp excede 4000 caracteres.' using errcode = '22023';
  end if;
  if not public.validate_user_preferences(v_preferences) then
    raise exception 'Preferências inválidas.' using errcode = '22023';
  end if;
  for v_index in 1..jsonb_array_length(v_preferences -> 'company' -> 'services') loop
    v_key := v_preferences -> 'company' -> 'services' -> (v_index - 1) ->> 'code';
    if v_prices ? v_key then
      v_preferences := jsonb_set(
        v_preferences,
        array['company','services',(v_index - 1)::text,'referenceValueCents'],
        case
          when v_prices -> v_key = 'null'::jsonb then 'null'::jsonb
          else to_jsonb(pg_catalog.round((v_prices ->> v_key)::numeric * 100))
        end
      );
    end if;
  end loop;
  return jsonb_build_object(
    'service_prices', v_prices,
    'whatsapp_template', p_payload ->> 'whatsapp_template',
    'preferences', v_preferences
  );
end;
$$;

revoke all on function public.validated_settings_payload(jsonb) from public, anon, authenticated;

create or replace function public.save_user_settings(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_payload jsonb;
  v_row public.user_settings;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  v_payload := public.validated_settings_payload(p_payload);
  insert into public.user_settings (owner_id, service_prices, whatsapp_template, preferences)
  values (v_owner, v_payload -> 'service_prices', v_payload ->> 'whatsapp_template', v_payload -> 'preferences')
  on conflict (owner_id) do update set
    service_prices = excluded.service_prices,
    whatsapp_template = excluded.whatsapp_template,
    preferences = excluded.preferences
  returning * into v_row;
  perform public.write_audit_event(v_owner, v_owner, 'settings.updated', 'user_settings', v_owner::text,
    jsonb_build_object('settings_version', (v_row.preferences ->> 'version')::int));
  return to_jsonb(v_row);
end;
$$;

create or replace function public.save_configuration(p_full_name text, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_name text := pg_catalog.btrim(coalesce(p_full_name, ''));
  v_settings jsonb;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if length(v_name) > 120 then raise exception 'Nome deve ter no máximo 120 caracteres.' using errcode = '22023'; end if;
  v_settings := public.save_user_settings(p_payload);
  update public.profiles set full_name = v_name where id = v_owner;
  if not found then
    insert into public.profiles (id, full_name) values (v_owner, v_name)
    on conflict (id) do update set full_name = excluded.full_name;
  end if;
  return v_settings;
end;
$$;

revoke all on function public.save_user_settings(jsonb) from public, anon, authenticated;
revoke all on function public.save_configuration(text,jsonb) from public, anon, authenticated;
grant execute on function public.save_user_settings(jsonb) to authenticated;
grant execute on function public.save_configuration(text,jsonb) to authenticated;

revoke insert, update, delete on public.user_settings from authenticated;

commit;
```

- [ ] **Step 3: Implementar `settingsService`**

Substitua `src/services/settingsService.ts` por:

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import { DEFAULT_SETTINGS, type ServicePrices, type UserPreferences, type UserSettings } from '../types/settings'
import { applyServicePriceReferences, defaultPreferences, validatePreferences } from '../lib/preferences'

function objectData<T>(data: unknown, message: string): T {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value as T
}

async function ownerId(): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error) throw new Error('Não foi possível validar sua sessão. Entre novamente.')
  const id = data.user?.id
  if (!id) throw new Error('Sua sessão expirou. Entre novamente.')
  return id
}

export async function getSettings(): Promise<UserSettings> {
  const id = await ownerId()
  const { data, error } = await requireSupabase().from('user_settings').select('*').eq('owner_id', id).maybeSingle()
  throwDbError(error)
  if (!data) {
    return {
      owner_id: id,
      service_prices: { ...DEFAULT_SETTINGS.service_prices },
      whatsapp_template: DEFAULT_SETTINGS.whatsapp_template,
      preferences: defaultPreferences(),
    }
  }
  const row = data as UserSettings
  const validation = validatePreferences(row.preferences)
  if (!validation.ok) throw new Error('Preferências salvas são inválidas. Atualize as migrations.')
  return { ...row, preferences: validation.value }
}

export async function getProfileName(): Promise<string> {
  const id = await ownerId()
  const { data, error } = await requireSupabase().from('profiles').select('full_name').eq('id', id).maybeSingle()
  throwDbError(error)
  return data?.full_name ?? ''
}

export async function updateProfileName(fullName: string): Promise<void> {
  const id = await ownerId()
  const { error } = await requireSupabase().from('profiles').update({ full_name: fullName.trim() }).eq('id', id)
  throwDbError(error)
}

export async function saveSettings(
  prices: ServicePrices,
  whatsappTemplate: string,
): Promise<UserSettings> {
  const preferences = applyServicePriceReferences(defaultPreferences(), prices)
  return saveConfiguration('', prices, whatsappTemplate, preferences, false)
}

export async function saveConfiguration(
  fullName: string,
  prices: ServicePrices,
  whatsappTemplate: string,
  preferences: UserPreferences,
  saveProfile = true,
): Promise<UserSettings> {
  const validation = validatePreferences(preferences)
  if (!validation.ok) throw new Error(validation.errors.join(' '))
  const normalized = applyServicePriceReferences(validation.value, prices)
  const { data, error } = await requireSupabase().rpc(
    saveProfile ? 'save_configuration' : 'save_user_settings',
    saveProfile
      ? { p_full_name: fullName.trim(), p_payload: { service_prices: prices, whatsapp_template: whatsappTemplate, preferences: normalized } }
      : { p_payload: { service_prices: prices, whatsapp_template: whatsappTemplate, preferences: normalized } },
  )
  throwDbError(error)
  const row = objectData<UserSettings>(data, 'Não foi possível salvar as configurações.')
  const saved = validatePreferences(row.preferences)
  if (!saved.ok) throw new Error('Resposta inválida ao salvar as configurações.')
  return { ...row, preferences: saved.value }
}

export async function previewOpportunityRecalculation(): Promise<{ affected: number; byPriority: Record<string, number> }> {
  const settings = await getSettings()
  const { data, error } = await requireSupabase().rpc('preview_opportunity_recalculation', {
    p_thresholds: settings.preferences.commercial.scoringThresholds,
  })
  throwDbError(error)
  const row = objectData<{ affected: number; by_priority: Record<string, number> }>(data, 'Prévia de recálculo inválida.')
  if (!Number.isSafeInteger(row.affected) || row.affected < 0 || !row.by_priority || typeof row.by_priority !== 'object') {
    throw new Error('Prévia de recálculo inválida.')
  }
  return { affected: row.affected, byPriority: row.by_priority }
}

export async function confirmOpportunityRecalculation(): Promise<number> {
  const settings = await getSettings()
  const { data, error } = await requireSupabase().rpc('recalculate_opportunity_priorities', {
    p_thresholds: settings.preferences.commercial.scoringThresholds,
    p_confirmation: 'RECALCULAR',
  })
  throwDbError(error)
  const row = objectData<{ updated: number }>(data, 'Resposta inválida do recálculo.')
  if (!Number.isSafeInteger(row.updated) || row.updated < 0) throw new Error('Resposta inválida do recálculo.')
  return row.updated
}
```

- [ ] **Step 4: Ampliar testes de serviço**

Acrescente ao `describe` de `settingsService.test.ts`:

```ts
describe('getSettings e saveConfiguration', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    rpc.mockReset()
    vi.mocked(requireSupabase).mockReturnValue({
      auth: { getUser }, from, rpc,
    } as unknown as SupabaseClient)
  })

  it('devolve defaults versionados quando não há linha', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    const result = await getSettings()
    expect(result.preferences.version).toBe(1)
    expect(result.service_prices.site).toBe(0)
    expect(readEq).toHaveBeenCalledWith('owner_id', userId)
  })

  it('salva perfil e settings em uma única RPC', async () => {
    rpc.mockResolvedValue({ data: { ...settings, preferences: settings.preferences }, error: null })
    await saveConfiguration(' Ana Silva ', settings.service_prices, settings.whatsapp_template, settings.preferences)
    expect(rpc).toHaveBeenCalledWith('save_configuration', {
      p_full_name: 'Ana Silva',
      p_payload: {
        service_prices: settings.service_prices,
        whatsapp_template: settings.whatsapp_template,
        preferences: expect.objectContaining({ version: 1 }),
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('rejeita preferências inválidas antes da RPC', async () => {
    await expect(saveConfiguration('Ana', settings.service_prices, '', {
      ...settings.preferences, ui: { ...settings.preferences.ui, itemsPerPage: 15 },
    })).rejects.toThrow('Itens por página inválido.')
    expect(rpc).not.toHaveBeenCalled()
  })
})
```

Atualize o fixture `settings` de `SettingsPage.test.tsx` para incluir `preferences: structuredClone(DEFAULT_PREFERENCES)` e importe `DEFAULT_PREFERENCES`.

- [ ] **Step 5: GREEN**

```bash
npm test -- src/services/settingsService.test.ts
```

Esperado: testes novos e antigos passam. O teste SQL só é executado se houver banco local/configuração autorizada; caso contrário fica dependente de configuração externa.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0011_etapa3_settings.sql supabase/tests/etapa3_settings.sql src/services/settingsService.ts src/services/settingsService.test.ts src/pages/SettingsPage.test.tsx
git commit -m "feat: persistir preferencias com validacao no banco"
```

### Task 4: Adicionar categorias de receita e categoria textual de tarefa

**Files:**

- Modify: `supabase/migrations/0011_etapa3_settings.sql`
- Modify: `supabase/tests/etapa3_settings.sql`
- Modify: `src/types/finance.ts`
- Modify: `src/types/project.ts`
- Modify: `src/services/contractService.ts`
- Modify: `src/services/projectTaskService.ts`
- Modify: `src/components/finance/PaymentDialog.tsx`
- Modify: `src/components/finance/PaymentDialog.test.tsx`
- Modify: `src/components/projects/ProjectTaskList.tsx`
- Modify: `src/components/projects/ProjectTaskList.test.tsx`
- Modify: `src/services/contractService.test.ts`
- Modify: `src/services/projectTaskService.test.ts`

**Interfaces consumed:** `record_payment(jsonb)`, `FinancialPayment`, `PaymentInput`, `ProjectTask`, `ProjectTaskWrite`, `taskPayload`, `ProjectTaskList`.

- [ ] **Step 1: Escrever testes RED de banco**

Acrescente ao final do `do $$` de `etapa3_settings.sql`, antes de `end\n$$;`:

```sql
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.create_revenue_category('Consultoria recorrente');
  if (v_result ->> 'name') <> 'Consultoria recorrente' then
    raise exception 'Categoria de receita não persistiu o nome.';
  end if;
  v_category_id := (v_result ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  v_result := public.create_revenue_category('Categoria do outro dono');
  v_foreign_category_id := (v_result ->> 'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  if exists (select 1 from public.revenue_categories where owner_id = v_other and id <> v_foreign_category_id) then
    raise exception 'Categoria de receita vazou para outro dono.';
  end if;
  begin
    perform public.create_revenue_category('consultoria recorrente');
    raise exception 'Categoria duplicada foi aceita.';
  exception when unique_violation then null;
  end;

  v_result := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente categoria de receita',
    'responsible_name', 'Responsável de teste', 'phone', '(11) 99999-9999',
    'whatsapp', '', 'email', 'categoria@example.test', 'cnpj', '', 'website', '',
    'instagram', '', 'address', '', 'city', 'São Paulo', 'district', '', 'zip_code', '',
    'state', 'SP', 'niche', 'Teste', 'status', 'active', 'notes', '',
    'service', 'Consultoria', 'total_value', '200.00', 'contracted_at', current_date,
    'due_date', current_date + 30, 'payment_method', 'pix', 'payment_terms', 'À vista',
    'contract_notes', ''
  ));
  v_client_id := ((v_result ->> 'client')::jsonb ->> 'id')::uuid;
  v_contract_id := ((v_result ->> 'contract')::jsonb ->> 'id')::uuid;
  if v_client_id is null or v_contract_id is null then raise exception 'Fixture financeira inválida.'; end if;

  begin
    perform public.record_payment(jsonb_build_object(
      'idempotency_key', gen_random_uuid(), 'contract_id', v_contract_id, 'type', 'receipt',
      'amount', '10.00', 'received_at', now(), 'revenue_category_id', v_foreign_category_id
    ));
    raise exception 'Categoria de outro dono foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'Categoria de receita inválida ou inativa.' then raise; end if;
  end;

  v_result := public.archive_revenue_category(v_category_id);
  begin
    perform public.record_payment(jsonb_build_object(
      'idempotency_key', gen_random_uuid(), 'contract_id', v_contract_id, 'type', 'receipt',
      'amount', '10.00', 'received_at', now(), 'revenue_category_id', v_category_id
    ));
    raise exception 'Categoria arquivada foi aceita.';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state <> '23514' or sqlerrm <> 'Categoria de receita inválida ou inativa.' then raise; end if;
  end;

  v_result := public.create_revenue_category('Consultoria ativa');
  v_category_id := (v_result ->> 'id')::uuid;
  v_result := public.record_payment(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-8000-000000000301', 'contract_id', v_contract_id,
    'type', 'receipt', 'amount', '100.00', 'received_at', now(),
    'revenue_category_id', v_category_id
  ));
  v_payment_id := (v_result ->> 'id')::uuid;
  if (v_result ->> 'already_existed') <> 'false'
    or (select revenue_category_id from public.financial_payments where id = v_payment_id) <> v_category_id then
    raise exception 'Categoria ativa não persistiu no recebimento.';
  end if;
  perform public.archive_revenue_category(v_category_id);
  v_result := public.record_payment(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-8000-000000000301', 'contract_id', v_contract_id,
    'type', 'receipt', 'amount', '999.00', 'received_at', now(),
    'revenue_category_id', v_category_id
  ));
  if (v_result ->> 'id')::uuid <> v_payment_id or (v_result ->> 'already_existed') <> 'true'
    or (select count(*) from public.financial_payments where contract_id = v_contract_id) <> 1 then
    raise exception 'Idempotência do pagamento foi quebrada pela categoria.';
  end if;
  v_result := public.record_payment(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-8000-000000000302', 'contract_id', v_contract_id,
    'type', 'receipt', 'amount', '50.00', 'received_at', now()
  ));
  if v_result ->> 'revenue_category_id' is not null then
    raise exception 'Pagamento legado sem categoria não permaneceu opcional.';
  end if;

  v_result := public.create_project(jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto da fixture de categoria',
    'service', 'Site', 'contracted_value', '200.00',
    'start_date', current_date, 'due_date', current_date + 15,
    'responsible_name', 'Responsável de teste', 'priority', 'high', 'description', 'Teste'
  ));
  v_project_id := (v_result ->> 'id')::uuid;

  begin
    insert into public.project_tasks (owner_id, project_id, title, category)
    values (v_owner, v_project_id, 'Categoria inválida', repeat('x', 41));
    raise exception 'Categoria de tarefa acima do limite foi aceita.';
  exception when check_violation then null;
  end;
```

Esperado no RED: `create_revenue_category` e a coluna `category` ainda não existem. O teste de persistência válida da categoria é coberto pelo serviço/componente do Plano 2 estendido abaixo.

- [ ] **Step 2: Acrescentar SQL de categorias antes do `commit;` de `0011`**

```sql
create table public.revenue_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60 and pg_catalog.btrim(name) <> ''),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint revenue_categories_owner_id_id_key unique (owner_id, id)
);

create unique index revenue_categories_owner_name_key
  on public.revenue_categories (owner_id, lower(name));
create index revenue_categories_owner_active_idx
  on public.revenue_categories (owner_id, name) where archived_at is null;

alter table public.revenue_categories enable row level security;
revoke all on public.revenue_categories from public, anon, authenticated;
grant select on public.revenue_categories to authenticated;
create policy revenue_categories_select_own on public.revenue_categories
  for select using (auth.uid() = owner_id);

create or replace function public.create_revenue_category(p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_name text := pg_catalog.btrim(p_name);
  v_row public.revenue_categories;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if length(v_name) not between 1 and 60 then
    raise exception 'Informe um nome de categoria entre 1 e 60 caracteres.' using errcode = '22023';
  end if;
  insert into public.revenue_categories (owner_id, name) values (v_owner, v_name)
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.archive_revenue_category(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_row public.revenue_categories;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  update public.revenue_categories set archived_at = coalesce(archived_at, now())
    where id = p_id and owner_id = v_owner
  returning * into v_row;
  if not found then raise exception 'Categoria de receita não encontrada.' using errcode = 'P0002'; end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_revenue_category(text) from public, anon, authenticated;
revoke all on function public.archive_revenue_category(uuid) from public, anon, authenticated;
grant execute on function public.create_revenue_category(text) to authenticated;
grant execute on function public.archive_revenue_category(uuid) to authenticated;

alter table public.financial_payments
  add column if not exists revenue_category_id uuid;
alter table public.financial_payments
  add constraint financial_payments_revenue_category_owner_fk
  foreign key (owner_id, revenue_category_id)
  references public.revenue_categories (owner_id, id) on delete restrict;
create index financial_payments_owner_revenue_category_idx
  on public.financial_payments (owner_id, revenue_category_id);

alter table public.project_tasks
  add column if not exists category text
  check (category is null or (length(category) between 1 and 40 and pg_catalog.btrim(category) <> ''));
```

- [ ] **Step 3: Redefinir `record_payment(jsonb)` aditivamente em `0011`**

Não edite `0009_etapa3_finance.sql`. Insira a redefinição completa abaixo em `0011`, copiada do corpo canônico do Plano 3 e modificada somente para aceitar `revenue_category_id` opcional. A validação da categoria fica depois do retorno idempotente para preservar replay; `pg_catalog.btrim`, ordem global de locks, saldo, estornos e alocações permanecem integralmente.

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
  v_client_id uuid;
  v_contract_id uuid;
  v_key uuid;
  v_type text;
  v_amount numeric;
  v_amount_text text;
  v_received_at timestamptz;
  v_related_id uuid;
  v_revenue_category_id uuid;
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

  v_revenue_category_id := nullif(pg_catalog.btrim(p_payload ->> 'revenue_category_id'), '')::uuid;
  if v_revenue_category_id is not null and not exists (
    select 1 from public.revenue_categories
    where id = v_revenue_category_id and owner_id = v_owner and archived_at is null
  ) then
    raise exception 'Categoria de receita inválida ou inativa.' using errcode = '23514';
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

  -- A leitura sem lock descobre o cliente; nenhuma linha fica retida enquanto se espera outra advisory.
  select * into v_contract
    from public.contracts
    where id = v_contract_id and owner_id = v_owner;
  if not found then raise exception 'Contrato não encontrado ou acesso negado.' using errcode = '42501'; end if;
  v_client_id := v_contract.client_id;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':clients', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_contract_id::text, 0)
  );
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
    received_at, payment_method, notes, revenue_category_id
  ) values (
    v_owner, v_contract_id, v_key, v_related_id, v_type, v_amount, v_received_at,
    nullif(pg_catalog.btrim(p_payload ->> 'payment_method'), ''), nullif(p_payload ->> 'notes', ''),
    v_revenue_category_id
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
```
- [ ] **Step 4: Escrever testes RED de TypeScript**

Em `src/services/projectTaskService.test.ts`:

```ts
it('envia a categoria textual junto com o payload completo da tarefa', async () => {
  await updateTask('task-1', {
    title: 'Layout', description: '', status: 'completed', responsibleName: '',
    startDate: null, dueDate: null, priority: 'medium', notes: '', category: 'Design',
  })
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Layout', status: 'completed', category: 'Design',
  }))
})

it('mantém criação e edição sem categoria e normaliza string vazia', async () => {
  await createTask('project-1', {
    title: 'Tarefa legada', description: '', status: 'pending', responsibleName: '',
    startDate: null, dueDate: null, priority: 'medium', notes: '',
  })
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ category: null }))
  await updateTask('task-1', {
    title: 'Tarefa legada', description: '', status: 'pending', responsibleName: '',
    startDate: null, dueDate: null, priority: 'medium', notes: '', category: '',
  })
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ category: null }))
})
```

Em `src/services/contractService.test.ts`:

```ts
it('envia categoria de receita opcional sem mudar o payload legado', async () => {
  db.rpc.mockResolvedValue({ data: { ...contractRow, id: 'payment-1', allocations: [], already_existed: false }, error: null })
  await recordPayment('contract-1', {
    idempotencyKey: '11111111-1111-4111-8111-111111111111', type: 'receipt',
    amountCents: 100, receivedAt: '2026-11-25T12:00:00-03:00', paymentMethod: 'pix',
    notes: '', relatedPaymentId: null, revenueCategoryId: 'category-1', allocations: [],
  })
  expect(db.rpc).toHaveBeenCalledWith('record_payment', expect.objectContaining({
    p_payload: expect.objectContaining({ revenue_category_id: 'category-1' }),
  }))
})
```

Comando RED:

```bash
npm test -- src/services/projectTaskService.test.ts src/services/contractService.test.ts
```

Esperado: as propriedades novas não são enviadas.

- [ ] **Step 5: Aplicar patches TypeScript**

Em `src/types/finance.ts`, acrescente `revenue_category_id: string | null` a `FinancialPayment` e `revenueCategoryId?: string | null` a `PaymentInput`. Em `src/types/project.ts`, acrescente `category: string | null` a `ProjectTask` e `category?: string | null` a `ProjectTaskWrite`. Ausência e string vazia normalizam para `null`; criação/edição legadas sem categoria continuam válidas.

Em `src/services/contractService.ts`, inclua `revenue_category_id: input.revenueCategoryId ?? null` no objeto enviado à RPC e inclua `revenue_category_id: row.revenue_category_id ?? null` em `toPayment`.

Acrescente:

```ts
export interface RevenueCategory {
  id: string
  owner_id: string
  name: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

export async function listRevenueCategories(): Promise<RevenueCategory[]> {
  const { data, error } = await requireSupabase()
    .from('revenue_categories').select('*').is('archived_at', null).order('name')
  throwDbError(error)
  return data ?? []
}
```

Em `src/services/projectTaskService.ts`, acrescente `category: nullable(input.category)` a `taskPayload`.

- [ ] **Step 6: Integrar seletores nas telas**

Em `PaymentDialog.tsx`:

- Importe `listRevenueCategories` e `type RevenueCategory`.
- Acrescente `const [revenueCategoryId, setRevenueCategoryId] = useState('')` e `const [revenueCategories, setRevenueCategories] = useState<RevenueCategory[]>([])`.
- No efeito que abre o diálogo, execute `void listRevenueCategories().then(setRevenueCategories).catch(() => setRevenueCategories([]))`; uma falha ao listar categorias não impede recebimento sem categoria.
- No reset, execute `setRevenueCategoryId('')`.
- Em `buildPayload`, acrescente `revenueCategoryId: revenueCategoryId || null` ao objeto retornado.
- Depois do `Select` de forma de pagamento, renderize:

```tsx
<Select
  label="Categoria de receita (opcional)"
  value={revenueCategoryId}
  disabled={disabled}
  onChange={(event) => setRevenueCategoryId(event.target.value)}
  options={[
    { value: '', label: 'Sem categoria' },
    ...revenueCategories.map((category) => ({ value: category.id, label: category.name })),
  ]}
/>
```

Em `ProjectTaskList.tsx`:

- Importe `usePreferences`.
- Em `TaskDraft`, acrescente `category: string`.
- Em `emptyDraft`, use `category: ''`.
- Em `draftFromTask`, use `category: task.category ?? ''`.
- Em `writeFromDraft` e `writeFromTask`, use `category: draft.category.trim()` e `category: task.category ?? ''`.
- Logo após o campo `responsibleName`, renderize:

```tsx
<Input
  label="Categoria (opcional)"
  value={draft.category}
  disabled={disabled}
  maxLength={40}
  list="project-task-categories"
  onChange={(event) => updateDraft({ category: event.target.value })}
/>
<datalist id="project-task-categories">
  {preferences.projects.taskCategories.map((category) => <option key={category} value={category} />)}
</datalist>
```

- Em cada cartão, mostre `{task.category && <span className="text-xs text-muted">{task.category}</span>}`.
- Na mudança apenas de status, `writeFromTask(task, nextStatus)` já preserva a categoria; não altere `calculateProjectProgress`.

- [ ] **Step 7: GREEN e commit**

```bash
npm test -- src/services/projectTaskService.test.ts src/services/contractService.test.ts src/components/finance/PaymentDialog.test.tsx src/components/projects/ProjectTaskList.test.tsx
git diff --check
git add supabase/migrations/0011_etapa3_settings.sql supabase/tests/etapa3_settings.sql src/types/finance.ts src/types/project.ts src/services/contractService.ts src/services/contractService.test.ts src/services/projectTaskService.ts src/services/projectTaskService.test.ts src/components/finance/PaymentDialog.tsx src/components/finance/PaymentDialog.test.tsx src/components/projects/ProjectTaskList.tsx src/components/projects/ProjectTaskList.test.tsx
git commit -m "feat: adicionar categorias de receita e tarefa"
```

Esperado: categoria de receita é opcional, estornos continuam válidos, tarefas antigas continuam com `category = null`, e seletores não alteram status/progresso.

---

### Task 5: Provider de preferências e consumidores centralizados

**Files:**

- Create: `src/components/preferences/PreferencesProvider.tsx`
- Create: `src/components/preferences/PreferencesProvider.test.tsx`
- Create: `src/components/preferences/OpportunityRecalculationCard.tsx`
- Modify: `src/routes/AppRoutes.tsx`
- Modify: `src/layouts/AppLayout.tsx`
- Modify: `src/components/ui/StatusBadge.tsx`
- Modify: `src/components/pipeline/KanbanColumn.tsx`
- Modify: `src/components/opportunities/OpportunityCard.tsx`
- Modify: `src/pages/LeadsPage.tsx`
- Modify: `src/pages/PipelinePage.tsx`
- Modify: `src/components/leads/OpportunityPanel.tsx`
- Modify: `src/components/projects/ProjectStatusBadge.tsx`
- Modify: `src/components/projects/ProjectKanbanColumn.tsx`
- Modify: `src/components/projects/ProjectStatusBadge.test.tsx`
- Modify: `src/components/projects/ProjectKanbanColumn.test.tsx`
- Modify: `src/pages/ProjectsPage.tsx`
- Modify: `src/pages/ProjectsPage.test.tsx`
- Modify: `src/pages/ProjectDetailPage.tsx`
- Modify: `src/pages/ProjectDetailPage.test.tsx`
- Modify: `src/lib/opportunity.ts`
- Modify: `src/lib/opportunity.test.ts`
- Modify: `supabase/tests/etapa3_settings.sql`

**Interfaces consumed:** `getSettings`, `computeOpportunity`, `LeadSort`, `LEAD_STATUSES`, `PROJECT_STATUSES`, `public.write_audit_event(uuid,uuid,text,text,text,jsonb)`.

- [ ] **Step 1: Testes RED do provider e thresholds**

```tsx
// @vitest-environment jsdom
// src/components/preferences/PreferencesProvider.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES } from '../../types/settings'

const { getSettings, saveConfiguration } = vi.hoisted(() => ({ getSettings: vi.fn(), saveConfiguration: vi.fn() }))
vi.mock('../../services/settingsService', () => ({ getSettings, saveConfiguration }))

import { PreferencesProvider, usePreferences } from './PreferencesProvider'

function Density() {
  const { preferences, loading } = usePreferences()
  return <span>{loading ? 'carregando' : preferences.ui.density}</span>
}

function SaveDensity() {
  const { preferences, updatePreferences } = usePreferences()
  const next = { ...preferences, ui: { ...preferences.ui, density: 'compact' as const } }
  return <>
    <span>densidade: {preferences.ui.density}</span>
    <button type="button" onClick={() => void saveConfiguration('Ana', {}, '', next, true)
      .then((saved) => updatePreferences(saved.preferences))}>
      Salvar densidade
    </button>
  </>
}

afterEach(cleanup)

describe('PreferencesProvider', () => {
  it('usa defaults sem provedor e carrega preferências salvas', async () => {
    getSettings.mockResolvedValue({ owner_id: 'owner', service_prices: {}, whatsapp_template: '', preferences: {
      ...structuredClone(DEFAULT_PREFERENCES), ui: { ...DEFAULT_PREFERENCES.ui, density: 'compact' },
    } })
    render(<PreferencesProvider><Density /></PreferencesProvider>)
    expect((await screen.findByText('compact')).textContent).toBe('compact')
    expect(getSettings).toHaveBeenCalledTimes(1)
  })

  it('mantém defaults quando a leitura falha', async () => {
    getSettings.mockRejectedValue(new Error('offline'))
    render(<PreferencesProvider><Density /></PreferencesProvider>)
    expect((await screen.findByText('comfortable')).textContent).toBe('comfortable')
  })

  it('atualiza o consumidor depois de salvar sem remontar o provedor', async () => {
    const initial = { ...structuredClone(DEFAULT_PREFERENCES), ui: { ...DEFAULT_PREFERENCES.ui, density: 'comfortable' as const } }
    const saved = { ...initial, ui: { ...initial.ui, density: 'compact' as const } }
    getSettings.mockResolvedValueOnce({ preferences: initial })
    saveConfiguration.mockResolvedValue({ preferences: saved })
    render(<PreferencesProvider><SaveDensity /></PreferencesProvider>)
    expect((await screen.findByText('densidade: comfortable')).textContent).toBe('densidade: comfortable')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar densidade' }))
    expect((await screen.findByText('densidade: compact')).textContent).toBe('densidade: compact')
    expect(saveConfiguration).toHaveBeenCalledTimes(1)
    expect(getSettings).toHaveBeenCalledTimes(1)
  })
})
```

Em `src/lib/opportunity.test.ts`:

```ts
it('aplica thresholds injetados sem mudar o cálculo do score', () => {
  const base = {
    niche: 'restaurante' as const, has_website: 'no' as const, has_instagram: 'yes' as const,
    has_facebook: 'unverified' as const, has_digital_menu: 'no' as const,
    has_digital_catalog: 'unverified' as const, has_landing_page: 'unverified' as const,
    has_business_whatsapp: 'unverified' as const, phone: null, whatsapp: null, email: null,
  }
  const standard = computeOpportunity(base)
  const custom = computeOpportunity(base, { veryHigh: 75, high: 60, medium: 40 })
  expect(priorityFromScore(70, { veryHigh: 75, high: 60, medium: 40 })).toBe('alta')
  expect(priorityFromScore(70)).toBe('alta')
  expect(custom.score).toBe(standard.score)
  expect(custom.needs).toEqual(standard.needs)
  expect(custom.priority).toBe('alta')
})
```

Comando RED:

```bash
npm test -- src/components/preferences/PreferencesProvider.test.tsx src/lib/opportunity.test.ts
```

Esperado: provider e parâmetro opcional não existem.

- [ ] **Step 2: Criar provider**

```tsx
// src/components/preferences/PreferencesProvider.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSettings } from '../../services/settingsService'
import { DEFAULT_PREFERENCES, type UserPreferences } from '../../types/settings'

interface PreferencesContextValue {
  preferences: UserPreferences
  loading: boolean
  refresh: () => Promise<void>
  updatePreferences: (next: UserPreferences) => void
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  loading: false,
  refresh: async () => undefined,
  updatePreferences: () => undefined,
})

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => structuredClone(DEFAULT_PREFERENCES))
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const settings = await getSettings()
      setPreferences(settings.preferences)
    } catch {
      setPreferences(structuredClone(DEFAULT_PREFERENCES))
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePreferences = useCallback((next: UserPreferences) => setPreferences(next), [])
  useEffect(() => { void refresh() }, [refresh])
  const value = useMemo(() => ({ preferences, loading, refresh, updatePreferences }), [preferences, loading, refresh, updatePreferences])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext)
}
```

- [ ] **Step 3: Conectar no layout autenticado**

Em `AppRoutes.tsx`, importe `PreferencesProvider` e envolva somente o elemento `AppLayout` do layout autenticado:

```tsx
<Route element={<PreferencesProvider><AppLayout /></PreferencesProvider>}>
```

Em `AppLayout.tsx`, use `usePreferences` e acrescente `data-density={preferences.ui.density}` no elemento raiz. Aplique `p-4 text-sm` quando compacto e `p-6 text-base` quando confortável no `<main>`. O import lazy de `BackupPage`, a rota `/backup` e o link de navegação pertencem exclusivamente à Task 10, depois que a página existir.

- [ ] **Step 4: Consumir rótulos e UI sem duplicar lógica**

Em `src/lib/opportunity.ts`, substitua a assinatura de `priorityFromScore` e o retorno de `computeOpportunity`:

```ts
export interface ScoringThresholds {
  veryHigh: number
  high: number
  medium: number
}

const DEFAULT_SCORING_THRESHOLDS: ScoringThresholds = { veryHigh: 80, high: 60, medium: 40 }

export function priorityFromScore(
  score: number,
  thresholds: ScoringThresholds = DEFAULT_SCORING_THRESHOLDS,
): Priority {
  if (score >= thresholds.veryHigh) return 'muito_alta'
  if (score >= thresholds.high) return 'alta'
  if (score >= thresholds.medium) return 'media'
  return 'baixa'
}

export function computeOpportunity(
  input: OpportunityInput,
  thresholds: ScoringThresholds = DEFAULT_SCORING_THRESHOLDS,
): OpportunityResult {
```

No final existente, troque `priority: priorityFromScore(score)` por `priority: priorityFromScore(score, thresholds)`. O restante do cálculo de score/necessidades permanece literalmente igual.

Crie seletores em `src/lib/preferences.ts`:

```ts
export function commercialStatusLabel(preferences: UserPreferences, status: string): string {
  return preferences.commercial.statusLabels[status] ?? status
}

export function projectStatusLabel(preferences: UserPreferences, status: string): string {
  return preferences.projects.statusLabels[status] ?? status
}

export function needLabel(preferences: UserPreferences, need: string): string {
  return preferences.opportunities.needLabels[need] ?? need
}
```

- `StatusBadge.tsx`: `const { preferences } = usePreferences(); const label = commercialStatusLabel(preferences, status)`.
- `KanbanColumn.tsx`: `const { preferences } = usePreferences(); const label = commercialStatusLabel(preferences, status)`.
- `PipelinePage.tsx`: substitua o array de colunas por `preferences.commercial.statusOrder`; mantenha `LEAD_STATUSES` como allowlist e mantenha a lógica de drag/handlers.
- `OpportunityCard.tsx` e `OpportunityPanel.tsx`: substitua `NEED_LABELS[need]` por `needLabel(preferences, need)`.
- `LeadsPage.tsx`: remova `PAGE_SIZE` fixo e use `preferences.ui.itemsPerPage`; substitua o sort inicial por `preferences.ui.defaultLeadSort` como `LeadSort`. Continue usando 20 enquanto o provider opcional não estiver presente.
- `ProjectStatusBadge.tsx`: importe `usePreferences` e `projectStatusLabel`; renderize `{projectStatusLabel(preferences, status)}`. Mantenha `PROJECT_STATUS_LABELS[status]` como fallback já coberto pelo seletor e preserve o mapa de estilos.
- `ProjectKanbanColumn.tsx`: use `projectStatusLabel(preferences, status)` nos dois `aria-label` e no `<h2>`; o valor de `status` continua sendo o código enviado aos handlers.
- `ProjectsPage.tsx`: no filtro, substitua `PROJECT_STATUS_LABELS[status]` por `projectStatusLabel(preferences, status)`; os badges já centralizados ficam em `ProjectStatusBadge`.
- `ProjectDetailPage.tsx`: substitua `PROJECT_STATUS_LABELS[status]` nas options de mudança de status e `PROJECT_STATUS_LABELS[pendingStatus]` na descrição do modal por `projectStatusLabel(preferences, ...)`.
- `ClientDetailPage.tsx` e `ClientsPage.tsx` continuam usando `CLIENT_STATUS_LABELS`: `commercial.statusLabels` valida exclusivamente `LEAD_STATUSES` e não contém códigos de cliente. Nenhuma mutação usa rótulo como código.

Acrescente esta regressão a `ProjectStatusBadge.test.tsx`; ela prova que o código do status não foi substituído pelo rótulo customizado:

```tsx
const { getSettings } = vi.hoisted(() => ({ getSettings: vi.fn() }))
vi.mock('../../services/settingsService', () => ({ getSettings }))
import { PreferencesProvider } from '../preferences/PreferencesProvider'
import { DEFAULT_PREFERENCES } from '../../types/settings'

it('usa o rótulo de projeto preferido sem alterar o código do status', async () => {
  getSettings.mockResolvedValue({ preferences: {
    ...structuredClone(DEFAULT_PREFERENCES),
    projects: { ...structuredClone(DEFAULT_PREFERENCES.projects), statusLabels: {
      ...DEFAULT_PREFERENCES.projects.statusLabels, planning: 'Plano customizado',
    } },
  } })
  render(<PreferencesProvider><ProjectStatusBadge status="planning" /></PreferencesProvider>)
  expect((await screen.findByText('Plano customizado')).textContent).toBe('Plano customizado')
})
```

Inclua `vi` no import de `vitest`. Atualize as expectativas dos testes de `ProjectKanbanColumn`, `ProjectsPage` e `ProjectDetailPage` para esse mesmo rótulo; os valores de filtro, drag e RPC devem permanecer os códigos canônicos.

- [ ] **Step 5: Recálculo explícito de prioridades**

Acrescente a RPC ao final de `0011`, antes do `commit;`:

```sql
create or replace function public.preview_opportunity_recalculation(p_thresholds jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_affected int;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select count(*) into v_affected from public.leads l
    where l.owner_id = v_owner
      and l.priority is distinct from case
        when l.score >= (p_thresholds ->> 'veryHigh')::int then 'muito_alta'
        when l.score >= (p_thresholds ->> 'high')::int then 'alta'
        when l.score >= (p_thresholds ->> 'medium')::int then 'media'
        else 'baixa' end;
  return jsonb_build_object('affected', v_affected, 'by_priority', '{}'::jsonb);
end;
$$;

create or replace function public.recalculate_opportunity_priorities(p_thresholds jsonb, p_confirmation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_updated int;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_confirmation is distinct from 'RECALCULAR' then raise exception 'Confirmação inválida.' using errcode = '22023'; end if;
  update public.leads set priority = case
    when score >= (p_thresholds ->> 'veryHigh')::int then 'muito_alta'
    when score >= (p_thresholds ->> 'high')::int then 'alta'
    when score >= (p_thresholds ->> 'medium')::int then 'media'
    else 'baixa' end
    where owner_id = v_owner
      and priority is distinct from case
        when score >= (p_thresholds ->> 'veryHigh')::int then 'muito_alta'
        when score >= (p_thresholds ->> 'high')::int then 'alta'
        when score >= (p_thresholds ->> 'medium')::int then 'media'
        else 'baixa' end;
  get diagnostics v_updated = row_count;
  perform public.write_audit_event(v_owner, v_owner, 'opportunities.recalculated', 'lead', v_owner::text,
    jsonb_build_object(
      'count', v_updated,
      'version', coalesce((select (preferences ->> 'version')::int from public.user_settings where owner_id = v_owner), 1)
    ));
  return jsonb_build_object('updated', v_updated);
end;
$$;

revoke all on function public.preview_opportunity_recalculation(jsonb) from public, anon, authenticated;
revoke all on function public.recalculate_opportunity_priorities(jsonb,text) from public, anon, authenticated;
grant execute on function public.preview_opportunity_recalculation(jsonb) to authenticated;
grant execute on function public.recalculate_opportunity_priorities(jsonb,text) to authenticated;
```

Acrescente ao final de `supabase/tests/etapa3_settings.sql`, imediatamente antes do `rollback;`, uma prova runtime separada. Ela só pode executar depois de `0011` → `0012` → `0013`:

```sql
do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-000000000001';
  v_result jsonb;
  v_audit_count int;
begin
  if pg_catalog.to_regprocedure('public.write_audit_event(uuid,uuid,text,text,text,jsonb)') is null then
    raise exception 'Execute 0011 -> 0012 -> 0013 antes do teste runtime de recálculo.';
  end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.recalculate_opportunity_priorities(
    (public.default_user_preferences() -> 'commercial' -> 'scoringThresholds'),
    'RECALCULAR'
  );
  if (v_result ->> 'updated')::int <> 0 then
    raise exception 'Recálculo sem alterações não retornou zero.';
  end if;
  select count(*) into v_audit_count from public.audit_events
    where owner_id = v_owner and actor_id = v_owner and action = 'opportunities.recalculated'
      and entity_type = 'lead' and entity_id = v_owner::text
      and metadata = jsonb_build_object('count', 0, 'version', 1)::jsonb;
  if v_audit_count <> 1 then
    raise exception 'Auditoria mínima do recálculo ausente ou duplicada.';
  end if;
end
$$;
```

Crie `OpportunityRecalculationCard.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '../ui/Button'
import { previewOpportunityRecalculation, confirmOpportunityRecalculation } from '../../services/settingsService'

export function OpportunityRecalculationCard() {
  const [affected, setAffected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function preview() {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await previewOpportunityRecalculation()
      setAffected(result.affected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível calcular a prévia.')
    } finally { setBusy(false) }
  }

  async function confirm() {
    setBusy(true); setError('')
    try {
      const updated = await confirmOpportunityRecalculation()
      setAffected(0); setMessage(`${updated} oportunidade(s) reclassificada(s).`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível recalcular.')
    } finally { setBusy(false) }
  }

  return <section className="rounded-xl border border-border p-4">
    <h3 className="font-semibold">Recalcular prioridades salvas</h3>
    <p className="text-sm text-muted">Usa os thresholds já salvos. Não recalcula o score nem altera necessidades.</p>
    <div className="mt-3 flex gap-2">
      <Button type="button" variant="secondary" loading={busy} onClick={() => void preview()}>Calcular prévia</Button>
      <Button type="button" disabled={busy || affected === null || affected === 0} onClick={() => void confirm()}>
        Confirmar recálculo
      </Button>
    </div>
    {affected !== null && <p className="mt-2 text-sm">{affected} registro(s) mudariam de prioridade.</p>}
    {message && <p role="status" className="mt-2 text-sm text-success">{message}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </section>
}
```

Renderize o cartão na seção Comercial de `SettingsPage`. O recálculo só usa thresholds salvos; o usuário salva primeiro e confirma a prévia depois.

- [ ] **Step 6: GREEN e commit**

```bash
npm test -- src/components/preferences/PreferencesProvider.test.tsx src/lib/opportunity.test.ts src/components/ui/StatusBadge.test.tsx src/pages/LeadsPage.test.tsx src/pages/PipelinePage.test.tsx src/components/projects/ProjectStatusBadge.test.tsx src/components/projects/ProjectKanbanColumn.test.tsx src/pages/ProjectsPage.test.tsx src/pages/ProjectDetailPage.test.tsx
git diff --check
git add src/components/preferences src/routes/AppRoutes.tsx src/layouts/AppLayout.tsx src/components/ui/StatusBadge.tsx src/components/pipeline/KanbanColumn.tsx src/components/opportunities src/components/leads/OpportunityPanel.tsx src/components/projects/ProjectStatusBadge.tsx src/components/projects/ProjectKanbanColumn.tsx src/components/projects/ProjectStatusBadge.test.tsx src/components/projects/ProjectKanbanColumn.test.tsx src/pages/LeadsPage.tsx src/pages/PipelinePage.tsx src/pages/ProjectsPage.tsx src/pages/ProjectsPage.test.tsx src/pages/ProjectDetailPage.tsx src/pages/ProjectDetailPage.test.tsx src/lib/opportunity.ts src/lib/opportunity.test.ts src/lib/preferences.ts supabase/migrations/0011_etapa3_settings.sql supabase/tests/etapa3_settings.sql
git commit -m "feat: aplicar preferencias comerciais e de interface"
```

Esperado: defaults mantêm comportamento atual, labels/ordem/paginação vêm das preferências e recálculo exige confirmação.

---

### Task 6: Completar SettingsPage com todas as seções

**Files:**

- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx`

**Interfaces consumed:** `getSettings`, `getProfileName`, `saveConfiguration`, `DEFAULT_PREFERENCES`, `applyServicePriceReferences`.

- [ ] **Step 1: Escrever testes RED da página**

Acrescente em `SettingsPage.test.tsx`:

```tsx
it('salva perfil, preços legados, template e preferences em uma única ação', async () => {
  renderPage()
  await screen.findByDisplayValue('Ana Silva')
  fireEvent.change(screen.getByLabelText('Nome da empresa'), { target: { value: 'Ber Studio' } })
  fireEvent.change(screen.getByLabelText('Notas comerciais'), { target: { value: 'Atendimento remoto.' } })
  fireEvent.change(screen.getByLabelText('Itens por página'), { target: { value: '50' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
  await waitFor(() => expect(saveConfiguration).toHaveBeenCalledTimes(1))
  expect(saveConfiguration).toHaveBeenCalledWith(
    'Ana Silva', expect.any(Object), expect.any(String),
    expect.objectContaining({
      company: expect.objectContaining({ name: 'Ber Studio', commercialNotes: 'Atendimento remoto.' }),
      ui: expect.objectContaining({ itemsPerPage: 50 }),
    }),
    true,
  )
  expect(saveSettings).not.toHaveBeenCalled()
  expect(updateProfileName).not.toHaveBeenCalled()
})

it('mostra erro de validação e não salva itens por página inválidos', async () => {
  renderPage()
  await screen.findByDisplayValue('Ana Silva')
  fireEvent.change(screen.getByLabelText('Itens por página'), { target: { value: '15' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Itens por página inválido.')
  expect(saveConfiguration).not.toHaveBeenCalled()
})

it('preserva preços em reais e converte a referência exibida em centavos', async () => {
  renderPage()
  await screen.findByDisplayValue('Ana Silva')
  fireEvent.change(screen.getByLabelText('Site (R$)'), { target: { value: '1200,50' } })
  expect(screen.getByText('Referência: R$ 1.200,50').textContent).toBe('Referência: R$ 1.200,50')
})
```

Atualize os mocks para `saveConfiguration`. Comando RED:

```bash
npm test -- src/pages/SettingsPage.test.tsx
```

Esperado: seções/controles não existem e ainda há chamadas paralelas antigas.

- [ ] **Step 2: Manter o carregamento existente e adicionar estado de preferences**

Em `SettingsPage.tsx`, importe `useRef`, `formatMoney`, `DEFAULT_PREFERENCES`, `type UserPreferences`, `validatePreferences`, `applyServicePriceReferences`, `saveConfiguration` e `usePreferences`. Obtenha `const { updatePreferences } = usePreferences()` e acrescente:

```tsx
const [preferences, setPreferences] = useState<UserPreferences>(() => structuredClone(DEFAULT_PREFERENCES))
const [error, setError] = useState('')
const savingRef = useRef(false)
```

No sucesso de `getSettings`, além de `setPrices(settings.service_prices)` e `setTemplate(settings.whatsapp_template)`, execute `setPreferences(settings.preferences)`. Na proteção contra resposta obsoleta, apenas atualize se o request ainda for o atual.

Substitua a função `save` paralela por:

```tsx
const save = async () => {
  if (savingRef.current) return
  savingRef.current = true
  setSaving(true); setError('')
  try {
    const validation = validatePreferences(preferences)
    if (!validation.ok) throw new Error(validation.errors.join(' '))
    const nextPreferences = applyServicePriceReferences(validation.value, prices)
    const saved = await saveConfiguration(fullName, prices, template, nextPreferences, true)
    setPreferences(saved.preferences)
    updatePreferences(saved.preferences)
    setPrices(saved.service_prices)
    setTemplate(saved.whatsapp_template)
    toast('Configurações salvas.')
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Não foi possível salvar as configurações.'
    setError(message)
    toast(message, 'error')
  } finally {
    savingRef.current = false
    setSaving(false)
  }
}
```

Mantenha o botão existente com `onClick={() => void save()}` e renderize `{error && <p role="alert" className="text-sm text-danger">{error}</p>}` antes dele. Preserve skeleton, retry, preview do template e bloqueio de duplo clique.

- [ ] **Step 3: Adicionar os controles literais**

Imediatamente após a seção Perfil, adicione:

```tsx
<section className="space-y-4 rounded-xl border border-border bg-surface p-6">
  <h2 className="text-lg font-semibold">Empresa e serviços</h2>
  <Input label="Nome da empresa" value={preferences.company.name} maxLength={120}
    onChange={(event) => setPreferences((current) => ({ ...current, company: { ...current.company, name: event.target.value } }))} />
  <Textarea label="Notas comerciais" value={preferences.company.commercialNotes} maxLength={2000}
    onChange={(event) => setPreferences((current) => ({ ...current, company: { ...current.company, commercialNotes: event.target.value } }))} />
  <Input label="Formas de pagamento da empresa" value={preferences.company.paymentMethods.join(', ')}
    onChange={(event) => setPreferences((current) => ({ ...current, company: {
      ...current.company, paymentMethods: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
    } }))} />
  <div className="space-y-3">
    {preferences.company.services.map((service, index) => <div key={service.code} className="grid gap-3 sm:grid-cols-3">
      <Input label={`Serviço ${index + 1}`} value={service.label} maxLength={60}
        onChange={(event) => updateService(index, { label: event.target.value })} />
      <Input label={`Prazo padrão em dias — ${service.label || service.code}`} type="number" min={1} max={365}
        value={String(service.defaultDays)}
        onChange={(event) => updateService(index, { defaultDays: Number(event.target.value) })} />
      <p className="self-end text-sm text-muted">Código imutável: {service.code}</p>
    </div>)}
  </div>
</section>
```

Acrescente o helper dentro de `SettingsPage`, junto de `save`:

```tsx
function updateService(index: number, patch: Partial<UserPreferences['company']['services'][number]>) {
  setPreferences((current) => ({ ...current, company: { ...current.company,
    services: current.company.services.map((service, position) => position === index ? { ...service, ...patch } : service),
  } }))
}
```

Depois da seção de preços legados, adicione:

```tsx
<section className="space-y-4 rounded-xl border border-border bg-surface p-6">
  <h2 className="text-lg font-semibold">Comercial e prospecção</h2>
  <Select label="Status comercial padrão" value={preferences.commercial.defaultStatus}
    options={preferences.commercial.statusOrder.map((status) => ({
      value: status, label: preferences.commercial.statusLabels[status],
    }))}
    onChange={(event) => setPreferences((current) => ({ ...current, commercial: {
      ...current.commercial, defaultStatus: event.target.value,
    } }))} />
  <Input label="Ordem dos status (separada por vírgula)" value={preferences.commercial.statusOrder.join(', ')}
    onChange={(event) => setPreferences((current) => ({ ...current, commercial: {
      ...current.commercial, statusOrder: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
    } }))} />
  {preferences.commercial.statusOrder.map((status) => <Input key={status} label={`Rótulo comercial — ${status}`}
    value={preferences.commercial.statusLabels[status] ?? ''}
    onChange={(event) => setPreferences((current) => ({ ...current, commercial: { ...current.commercial,
      statusLabels: { ...current.commercial.statusLabels, [status]: event.target.value },
    } }))} />)}
  <Input label="Intervalos de follow-up em dias" value={preferences.commercial.followupIntervalsDays.join(', ')}
    onChange={(event) => setPreferences((current) => ({ ...current, commercial: { ...current.commercial,
      followupIntervalsDays: event.target.value.split(',').map((item) => Number(item.trim())).filter(Number.isInteger),
    } }))} />
  <div className="grid gap-3 sm:grid-cols-3">
    {(['veryHigh', 'high', 'medium'] as const).map((key) => <Input key={key} type="number" min={0} max={100}
      label={`Threshold ${key}`} value={String(preferences.commercial.scoringThresholds[key])}
      onChange={(event) => setPreferences((current) => ({ ...current, commercial: { ...current.commercial,
        scoringThresholds: { ...current.commercial.scoringThresholds, [key]: Number(event.target.value) },
      } }))} />)}
  </div>
  <OpportunityRecalculationCard />
</section>
```

Adicione Oportunidades:

```tsx
<section className="space-y-4 rounded-xl border border-border bg-surface p-6">
  <h2 className="text-lg font-semibold">Oportunidades</h2>
  {Object.entries(preferences.opportunities.needLabels).map(([need, label]) => <Input key={need}
    label={`Rótulo da necessidade — ${need}`} value={label}
    onChange={(event) => setPreferences((current) => ({ ...current, opportunities: { needLabels: {
      ...current.opportunities.needLabels, [need]: event.target.value,
    } } }))} />)}
  <p className="text-sm text-muted">Scores e necessidades já gravados não são recalculados ao salvar.</p>
</section>
```

Adicione Projetos:

```tsx
<section className="space-y-4 rounded-xl border border-border bg-surface p-6">
  <h2 className="text-lg font-semibold">Projetos</h2>
  <Input label="Categorias de tarefa" value={preferences.projects.taskCategories.join(', ')}
    onChange={(event) => setPreferences((current) => ({ ...current, projects: { ...current.projects,
      taskCategories: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
    } }))} />
  {Object.entries(preferences.projects.statusLabels).map(([status, label]) => <Input key={status}
    label={`Rótulo de projeto — ${status}`} value={label}
    onChange={(event) => setPreferences((current) => ({ ...current, projects: { ...current.projects,
      statusLabels: { ...current.projects.statusLabels, [status]: event.target.value },
    } } }))} />)}
</section>
```

Adicione Financeiro e Interface:

```tsx
<section className="space-y-4 rounded-xl border border-border bg-surface p-6">
  <h2 className="text-lg font-semibold">Financeiro</h2>
  <Select label="Exibição financeira" value={preferences.finance.display}
    options={[{ value: 'comfortable', label: 'Confortável' }, { value: 'compact', label: 'Compacta' }]}
    onChange={(event) => setPreferences((current) => ({ ...current, finance: {
      ...current.finance, display: event.target.value as 'compact' | 'comfortable',
    } }))} />
  <p className="text-sm text-muted">Categorias de receita são gerenciadas no recebimento. Categorias de despesa continuam no financeiro.</p>
</section>

<section className="space-y-4 rounded-xl border border-border bg-surface p-6">
  <h2 className="text-lg font-semibold">Interface</h2>
  <Select label="Densidade" value={preferences.ui.density}
    options={[{ value: 'comfortable', label: 'Confortável' }, { value: 'compact', label: 'Compacta' }]}
    onChange={(event) => setPreferences((current) => ({ ...current, ui: {
      ...current.ui, density: event.target.value as 'compact' | 'comfortable',
    } }))} />
  <Select label="Itens por página" value={String(preferences.ui.itemsPerPage)}
    options={[10, 20, 50, 100].map((value) => ({ value: String(value), label: String(value) }))}
    onChange={(event) => setPreferences((current) => ({ ...current, ui: {
      ...current.ui, itemsPerPage: Number(event.target.value),
    } }))} />
  <Select label="Ordenação padrão de leads" value={preferences.ui.defaultLeadSort}
    options={[
      { value: 'created_desc', label: 'Mais recentes' }, { value: 'created_asc', label: 'Mais antigos' },
      { value: 'score_desc', label: 'Maior score' }, { value: 'score_asc', label: 'Menor score' },
    ]}
    onChange={(event) => setPreferences((current) => ({ ...current, ui: {
      ...current.ui, defaultLeadSort: event.target.value,
    } }))} />
</section>
```

Na seção de preços, ao lado de cada campo, mostre `Referência: {formatMoney(referenceValueCents)}` quando o valor não for nulo.

- [ ] **Step 4: GREEN e commit**

```bash
npm test -- src/pages/SettingsPage.test.tsx src/services/settingsService.test.ts src/lib/preferences.test.ts
git diff --check
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat: completar configuracoes versionadas na interface"
```

Esperado: uma única RPC atômica, validação visível, todas as seções presentes, preços legados em reais e nenhuma recalculação implícita.

### Task 7: Contratos e formato local do backup

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/types/backup.ts`
- Create: `src/lib/backupFormat.ts`
- Create: `src/lib/backupFormat.test.ts`

**Interfaces consumed:** nenhum contrato de runtime anterior; os tipos de domínio e `leads.maps_url` vêm dos Planos 1–3 e da Etapa 2.

**Interfaces produced:** `BACKUP_LIMITS`, `BACKUP_TABLES`, `emptyBackupTables`, `createBackupPackage`, `createBackupArchive`, `parseBackupArchive`, `sha256Hex`, `toCsvCell`, `fromCsvCell`, `BackupManifest`, `BackupPackage`, `RestorePreview`, `BackupDiagnostics`, `BackupDiagnosticCheck` e `RestoreResult`.

- [ ] **Step 1: Instalar somente a dependência de ZIP**

```bash
npm install --save-exact fflate@0.8.2
```

Esperado: `fflate` entra em `dependencies` fixado em `0.8.2` e o lockfile é atualizado. Não instalar bibliotecas de arquivo, criptografia ou backend.

- [ ] **Step 2: Escrever testes RED**

```ts
// src/lib/backupFormat.test.ts
import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, zipSync } from 'fflate'
import {
  BACKUP_LIMITS, BACKUP_TABLES, createBackupArchive, createBackupPackage, emptyBackupTables,
  parseBackupArchive, sha256Hex, toCsvCell, fromCsvCell,
} from './backupFormat'
import type { BackupPackage } from '../types/backup'

const OWNER = '11111111-1111-4111-8111-111111111111'

function tables() {
  const value = emptyBackupTables()
  value.leads = [{
    id: '22222222-2222-4222-8222-222222222222', owner_id: OWNER, name: '=COMANDO()',
    responsible_name: null, niche: null, phone: null, whatsapp: null, email: null, cnpj: null,
    instagram: null, facebook: null, website: null, menu_url: null, catalog_url: null,
    maps_url: 'https://www.google.com/maps/place/?q=placeid:ChIJ-exemplo',
    country: 'Brasil', state: null, city: null, district: null, address: null, zip_code: null,
    has_website: 'unverified', has_instagram: 'unverified', has_facebook: 'unverified',
    has_digital_menu: 'unverified', has_digital_catalog: 'unverified', has_landing_page: 'unverified',
    has_business_whatsapp: 'unverified', status: 'novo', offered_service: null, notes: 'linha 1\nlinha 2',
    source: null, next_contact_at: null, last_verified_at: null, estimated_value: '0.00',
    negotiated_value: '0.00', contracted_value: '0.00', received_value: '0.00', score: 0,
    priority: 'baixa', needs: [], score_reasons: [], created_at: '2026-11-26T00:00:00Z',
    updated_at: '2026-11-26T00:00:00Z',
  }]
  return value
}

function archiveEntries(pkg: BackupPackage): Record<string, Uint8Array> {
  return {
    ...Object.fromEntries(BACKUP_TABLES.map((definition) => [definition.file, strToU8(pkg.csvText[definition.file])])),
    'manifest.json': strToU8(JSON.stringify(pkg.manifest)),
  }
}

function forgeUncompressedSize(bytes: Uint8Array, fileName: string, size: number): Uint8Array {
  const forged = bytes.slice()
  const view = new DataView(forged.buffer)
  let end = forged.byteLength - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1
  if (end < 0) throw new Error('Fixture ZIP inválida.')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  for (let index = 0; index < count; index += 1) {
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const name = strFromU8(forged.subarray(offset + 46, offset + 46 + nameLength))
    if (name === fileName) {
      const localOffset = view.getUint32(offset + 42, true)
      view.setUint32(offset + 24, size, true)
      view.setUint32(localOffset + 22, size, true)
      return forged
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  throw new Error('Arquivo não encontrado na fixture ZIP.')
}

describe('backupFormat', () => {
  it('faz round-trip com BOM, delimitador, null, JSON e proteção de fórmula', async () => {
    expect(toCsvCell('=COMANDO()')).toBe("'=COMANDO()")
    expect(fromCsvCell("'=COMANDO()")).toBe('=COMANDO()')
    expect(toCsvCell(null)).toBe('\\N')
    expect(fromCsvCell('\\N')).toBeNull()
    expect(fromCsvCell('[]')).toBe('[]')
    expect(toCsvCell({ b: 2, a: ['á', null, 1e21] })).toBe('{"a":["á",null,1000000000000000000000],"b":2}')
    expect(toCsvCell('\n=cmd')).toBe("'\n=cmd")
    expect(toCsvCell('  +cmd')).toBe("'  +cmd")
    expect(toCsvCell('\t@cmd')).toBe("'\t@cmd")
    expect(toCsvCell("'=cmd")).toBe("''=cmd")
    expect(toCsvCell('-1')).toBe("'-1")
    expect(fromCsvCell("''=cmd")).toBe("'=cmd")
    expect(fromCsvCell("'-1")).toBe('-1')
    expect(toCsvCell('texto normal')).toBe('texto normal')
    expect(() => toCsvCell('x'.repeat(BACKUP_LIMITS.fieldBytes + 1))).toThrow('1 MiB')
    const maxProtected = `'=${'x'.repeat(BACKUP_LIMITS.fieldBytes - 1)}`
    expect(fromCsvCell(maxProtected)).toBe(`=${'x'.repeat(BACKUP_LIMITS.fieldBytes - 1)}`)
    expect(() => fromCsvCell(`'${'x'.repeat(BACKUP_LIMITS.fieldBytes)}`)).toThrow('1 MiB')

    const pkg = await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')
    expect(pkg.csvText.leads).toContain('Maps url')
    expect(pkg.csvText.leads.endsWith('\n')).toBe(true)
    expect(pkg.csvText.checks.endsWith('\n')).toBe(true)
    const bytes = await createBackupArchive(pkg)
    const parsed = await parseBackupArchive(bytes, OWNER)
    expect(parsed.tables.leads[0].name).toBe('=COMANDO()')
    expect(parsed.tables.leads[0].notes).toBe('linha 1\nlinha 2')
    expect(parsed.tables.leads[0].needs).toEqual([])
    expect(parsed.tables.leads[0].maps_url).toBe('https://www.google.com/maps/place/?q=placeid:ChIJ-exemplo')
    expect(parsed.csvText).toEqual(pkg.csvText)
    expect(parsed.manifest.files).toHaveLength(BACKUP_TABLES.length)
    expect(parsed.manifest.totalRows).toBe(1)
  })

  it('rejeita CSV alterado sem recalcular o hash do manifesto', async () => {
    const pkg = await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')
    pkg.csvText.leads = pkg.csvText.leads.replace("'=COMANDO()", "'=OUTRO()")
    await expect(parseBackupArchive(await createBackupArchive(pkg), OWNER)).rejects.toThrow('Hash do arquivo')
  })

  it('rejeita manifest de outro proprietário e chave de credencial', async () => {
    await expect(parseBackupArchive(
      await createBackupArchive(await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')),
      '33333333-3333-4333-8333-333333333333',
    )).rejects.toThrow('proprietário')

    const malicious = await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')
    malicious.manifest.files[0].columns = ['access_token']
    await expect(parseBackupArchive(zipSync(archiveEntries(malicious)), OWNER)).rejects.toThrow('Colunas')
  })

  it('rejeita ZIP acima do limite e hash zerado', async () => {
    await expect(parseBackupArchive(new Uint8Array(BACKUP_LIMITS.zipBytes + 1), OWNER))
      .rejects.toThrow('ZIP')

    const pkg = await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')
    pkg.manifest.files[0].sha256 = '0'.repeat(64)
    await expect(parseBackupArchive(zipSync(archiveEntries(pkg)), OWNER)).rejects.toThrow('Hash')
  })

  it('limita a expansão real e rejeita tamanhos descompactados forjados', async () => {
    const pkg = await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')
    pkg.csvText.leads = pkg.csvText.leads.replace('linha 1\nlinha 2', 'x'.repeat(BACKUP_LIMITS.uncompressedBytes))
    pkg.manifest.files.find((file) => file.name === 'leads.csv')!.sha256 =
      await sha256Hex(strToU8(pkg.csvText.leads))
    const bomb = zipSync(archiveEntries(pkg), { level: 6 })
    expect(bomb.byteLength).toBeLessThanOrEqual(BACKUP_LIMITS.zipBytes)
    await expect(parseBackupArchive(bomb, OWNER)).rejects.toThrow('ZIP excede o limite descompactado')

    const forged = forgeUncompressedSize(bomb, 'leads.csv', 1)
    await expect(parseBackupArchive(forged, OWNER)).rejects.toThrow('Tamanho descompactado divergente no ZIP')
  }, 30_000)

  it('rejeita arquivo ausente, ordem divergente e conteúdo não canônico mesmo com hash atualizado', async () => {
    const pkg = await createBackupPackage(tables(), OWNER, '2026-11-26T12:00:00.000Z')
    const missing = archiveEntries(pkg)
    delete missing['checks.csv']
    await expect(parseBackupArchive(zipSync(missing), OWNER)).rejects.toThrow('somente o manifesto')

    const leadId = String(pkg.tables.leads[0].id)
    pkg.tables.lead_digital_checks = [
      { id: '44444444-4444-4444-8444-444444444444', lead_id: leadId, owner_id: OWNER,
        item: 'instagram', verified: false, verified_at: null, created_at: '2026-11-26T00:00:00Z' },
      { id: '55555555-5555-4555-8555-555555555555', lead_id: leadId, owner_id: OWNER,
        item: 'website', verified: true, verified_at: '2026-11-26T01:00:00Z', created_at: '2026-11-26T00:00:00Z' },
    ]
    const ordered = await createBackupPackage(pkg.tables, OWNER, '2026-11-26T12:00:00.000Z')
    const lines = ordered.csvText.checks.split('\n').filter((line, index) => index === 0 || line.length > 0)
    ordered.csvText.checks = [lines[0], lines[2], lines[1]].join('\n') + '\n'
    ordered.manifest.files.find((file) => file.name === 'checks.csv')!.sha256 =
      await sha256Hex(strToU8(ordered.csvText.checks))
    await expect(parseBackupArchive(zipSync(archiveEntries(ordered)), OWNER))
      .rejects.toThrow('Ordem ou conteúdo canônico')

    const noncanonical = await createBackupPackage(pkg.tables, OWNER, '2026-11-26T12:00:00.000Z')
    noncanonical.csvText.leads = noncanonical.csvText.leads.replace('\uFEFFID', '\uFEFF ID')
    noncanonical.manifest.files.find((file) => file.name === 'leads.csv')!.sha256 =
      await sha256Hex(strToU8(noncanonical.csvText.leads))
    await expect(parseBackupArchive(zipSync(archiveEntries(noncanonical)), OWNER))
      .rejects.toThrow('Ordem ou conteúdo canônico')
  })

  it('calcula SHA-256 hexadecimal', async () => {
    expect(await sha256Hex(strToU8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
```

Comando RED:

```bash
npm test -- src/lib/backupFormat.test.ts
```

Esperado: tipos/formatador não existem.

- [ ] **Step 3: Criar contratos**

```ts
// src/types/backup.ts
export const BACKUP_LIMITS = {
  zipBytes: 25 * 1024 * 1024,
  uncompressedBytes: 50 * 1024 * 1024,
  files: 32,
  rows: 50_000,
  rpcBytes: 4 * 1024 * 1024,
  columns: 64,
  fieldBytes: 1024 * 1024,
} as const

export interface BackupFileManifest {
  name: string
  rows: number
  sha256: string
  columns: string[]
}

export interface BackupManifest {
  format: 'ber-crm-backup'
  version: 1
  createdAt: string
  ownerId: string
  files: BackupFileManifest[]
  totalRows: number
}

export interface BackupPackage {
  manifest: BackupManifest
  tables: Record<string, Array<Record<string, unknown>>>
  csvText: Record<string, string>
}

export interface RestorePreview {
  previewId: string
  packageHash: string
  canRestore: boolean
  totals: { new: number; identical: number; conflict: number }
  tables: Array<{ table: string; new: number; identical: number; conflict: number }>
  issues: string[]
}

export interface BackupDiagnosticCheck {
  code: string
  severity: 'info' | 'warning' | 'critical'
  count: number
  sampleIds: string[]
}

export interface BackupDiagnostics {
  generatedAt: string
  schemaVersion: number
  checks: BackupDiagnosticCheck[]
  limits: {
    rows: number
    zipBytes: number
    uncompressedBytes: number
    rpcBytes: number
    fieldBytes: number
    files: number
    columns: number
  }
}

export interface RestoreResult {
  inserted: Record<string, number>
  auditEventId: string
}
```

- [ ] **Step 4: Criar o registry e o formatador**

```ts
// src/lib/backupFormat.ts
import Papa from 'papaparse'
import { concatU8, strFromU8, strToU8, Unzip, UnzipInflate, UnzipPassThrough, zipSync } from 'fflate'
import { BACKUP_LIMITS, type BackupManifest, type BackupPackage } from '../types/backup'

export interface BackupTableDefinition {
  table: string
  file: string
  key: 'id' | 'owner_id'
  columns: readonly string[]
}

export const BACKUP_TABLES: readonly BackupTableDefinition[] = [
  { table: 'leads', file: 'leads.csv', key: 'id', columns: [
    'id','owner_id','name','responsible_name','niche','phone','whatsapp','email','cnpj','instagram','facebook','website','menu_url','catalog_url','maps_url',
    'country','state','city','district','address','zip_code','has_website','has_instagram','has_facebook','has_digital_menu','has_digital_catalog','has_landing_page','has_business_whatsapp',
    'status','offered_service','notes','source','next_contact_at','last_verified_at','estimated_value','negotiated_value','contracted_value','received_value','score','priority','needs','score_reasons','created_at','updated_at',
  ] },
  { table: 'lead_activities', file: 'lead_activities.csv', key: 'id', columns: ['id','lead_id','owner_id','type','description','user_id','created_at'] },
  { table: 'lead_followups', file: 'lead_followups.csv', key: 'id', columns: ['id','lead_id','owner_id','due_at','reason','note','status','completed_at','result','created_at','updated_at'] },
  { table: 'lead_digital_checks', file: 'checks.csv', key: 'id', columns: ['id','lead_id','owner_id','item','verified','verified_at','created_at'] },
  { table: 'clients', file: 'clients.csv', key: 'id', columns: [
    'id','owner_id','creation_key','name','responsible_name','phone','whatsapp','email','cnpj','website','instagram','address','city','district','zip_code','state','niche','status','source','converted_at','notes','archived_at','created_at','updated_at',
  ] },
  { table: 'lead_client_links', file: 'lead_client_links.csv', key: 'id', columns: ['id','owner_id','lead_id','client_id','converted_at','created_at'] },
  { table: 'contracts', file: 'contracts.csv', key: 'id', columns: ['id','owner_id','client_id','source_link_id','creation_key','service','total_value','contracted_at','due_date','payment_method','payment_terms','status','notes','cancelled_at','created_at','updated_at'] },
  { table: 'projects', file: 'projects.csv', key: 'id', columns: ['id','owner_id','client_id','contract_id','source_link_id','name','service','contracted_value','description','start_date','due_date','responsible_name','priority','status','completed_at','delivered_at','delivery_confirmed_at','delivery_url','files_url','final_notes','archived_at','created_at','updated_at'] },
  { table: 'client_activities', file: 'client_activities.csv', key: 'id', columns: ['id','owner_id','client_id','project_id','contract_id','type','description','metadata','created_by','created_at'] },
  { table: 'project_tasks', file: 'project_tasks.csv', key: 'id', columns: ['id','owner_id','project_id','title','description','status','responsible_name','start_date','due_date','priority','position','notes','completed_at','cancelled_at','category','created_at','updated_at'] },
  { table: 'project_revisions', file: 'project_revisions.csv', key: 'id', columns: ['id','owner_id','project_id','requested_at','description','responsible_name','status','completed_at','approved_at','notes','created_at','updated_at'] },
  { table: 'contract_installments', file: 'contract_installments.csv', key: 'id', columns: ['id','owner_id','contract_id','position','amount','due_date','notes','created_at','updated_at'] },
  { table: 'expense_categories', file: 'expense_categories.csv', key: 'id', columns: ['id','owner_id','name','archived_at','created_at','updated_at'] },
  { table: 'revenue_categories', file: 'revenue_categories.csv', key: 'id', columns: ['id','owner_id','name','archived_at','created_at','updated_at'] },
  { table: 'financial_payments', file: 'financial_payments.csv', key: 'id', columns: ['id','owner_id','contract_id','idempotency_key','related_payment_id','type','amount','received_at','payment_method','notes','revenue_category_id','created_by','created_at'] },
  { table: 'financial_payment_allocations', file: 'allocations.csv', key: 'id', columns: ['id','owner_id','contract_id','payment_id','installment_id','amount','created_at'] },
  { table: 'financial_expenses', file: 'expenses.csv', key: 'id', columns: ['id','owner_id','description','category_id','amount','expense_date','due_date','paid_at','payment_method','status','project_id','contract_id','notes','cancelled_at','created_at','updated_at'] },
  { table: 'user_settings', file: 'preferences.csv', key: 'owner_id', columns: ['owner_id','service_prices','whatsapp_template','preferences','created_at','updated_at'] },
]

const JSON_COLUMNS = new Set(['needs','score_reasons','metadata','service_prices','preferences'])
const DANGEROUS = new Set(["'", '=', '+', '-', '@'])
const LEADING_IGNORABLE = /^[\s\u0000-\u001f\u007f-\u009f]*/

const HEADER_OVERRIDES: Record<string, string> = {
  id: 'ID', owner_id: 'Proprietário', lead_id: 'Lead', client_id: 'Cliente', project_id: 'Projeto',
  contract_id: 'Contrato', user_id: 'Usuário', created_by: 'Criado por', created_at: 'Criado em',
  updated_at: 'Atualizado em', name: 'Nome', responsible_name: 'Responsável', status: 'Status',
  notes: 'Notas', description: 'Descrição', type: 'Tipo', amount: 'Valor', total_value: 'Valor total',
  position: 'Posição', priority: 'Prioridade', category: 'Categoria', source: 'Origem',
  due_date: 'Vencimento', start_date: 'Início', phone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail',
  cnpj: 'CNPJ', niche: 'Nicho', city: 'Cidade', state: 'Estado', district: 'Bairro', address: 'Endereço',
  zip_code: 'CEP', service: 'Serviço', payment_method: 'Forma de pagamento', preferences: 'Preferências',
  service_prices: 'Preços de serviço', whatsapp_template: 'Template do WhatsApp',
}

function headerFor(column: string): string {
  if (HEADER_OVERRIDES[column]) return HEADER_OVERRIDES[column]
  const words = column.split('_')
  return words.map((word, index) => index === 0
    ? word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    : word).join(' ')
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

export function emptyBackupTables(): Record<string, Array<Record<string, unknown>>> {
  return Object.fromEntries(BACKUP_TABLES.map((definition) => [definition.table, []]))
}

function firstSignificantCharacter(value: string): string {
  return value.charAt(value.match(LEADING_IGNORABLE)?.[0].length ?? 0)
}

function compareUtf8(left: string, right: string): number {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return a.length - b.length
}

function expandNumberExponent(text: string): string {
  const [coefficient, exponentText] = text.toLowerCase().split('e')
  if (exponentText === undefined) return text
  const exponent = Number(exponentText)
  const negative = coefficient.startsWith('-')
  const unsigned = negative ? coefficient.slice(1) : coefficient
  const [integer, fraction = ''] = unsigned.split('.')
  const digits = integer + fraction
  const decimalIndex = integer.length + exponent
  const expanded = decimalIndex <= 0
    ? `0.${'0'.repeat(-decimalIndex)}${digits}`
    : decimalIndex >= digits.length
      ? `${digits}${'0'.repeat(decimalIndex - digits.length)}`
      : `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`
  return negative ? `-${expanded}` : expanded
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort(compareUtf8)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número JSON não finito.')
    return expandNumberExponent(JSON.stringify(value))
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  throw new Error('Valor JSON não serializável.')
}

function assertFieldBytes(text: string): void {
  if (new TextEncoder().encode(text).byteLength > BACKUP_LIMITS.fieldBytes) {
    throw new Error('Campo textual excede 1 MiB.')
  }
}

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '\\N'
  const text = typeof value === 'object'
    ? canonicalJson(value)
    : typeof value === 'number'
      ? Number.isFinite(value) ? expandNumberExponent(JSON.stringify(value)) : (() => { throw new Error('Número não finito.') })()
      : typeof value === 'string' || typeof value === 'boolean' ? String(value) : (() => { throw new Error('Valor CSV não serializável.') })()
  assertFieldBytes(text)
  if (text === '\\N') return '\\\\N'
  if (DANGEROUS.has(firstSignificantCharacter(text))) return `'${text}`
  return text
}

export function fromCsvCell(value: string): unknown {
  if (value === '\\N') return null
  if (value === '\\\\N') return '\\N'
  const decoded = value.startsWith("'") && DANGEROUS.has(firstSignificantCharacter(value.slice(1)))
    ? value.slice(1)
    : value
  assertFieldBytes(decoded)
  return decoded
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.slice()
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function encodeCsv(definition: BackupTableDefinition, rows: Array<Record<string, unknown>>): { text: string; bytes: Uint8Array } {
  const data = rows.map((row) => {
    if (!exactKeys(row, definition.columns)) throw new Error(`Colunas inválidas em ${definition.file}.`)
    return definition.columns.map((column) => toCsvCell(row[column]))
  })
  const csv = Papa.unparse({
    fields: definition.columns.map(headerFor), data,
  }, { delimiter: ';', quotes: true, quoteChar: '"', escapeChar: '"', newline: '\n', header: true })
  const text = `\uFEFF${csv}\n`
  return { text, bytes: strToU8(text) }
}

function zipDirectory(bytes: Uint8Array): Array<{ name: string; size: number }> {
  if (bytes.byteLength < 22) throw new Error('ZIP inválido.')
  let end = -1
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x05 && bytes[index + 3] === 0x06) {
      end = index
      break
    }
  }
  if (end < 0 || bytes.length - (end + 22) !== viewUint16(bytes, end + 20)) throw new Error('ZIP inválido.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint16(end + 10, true)
  const centralSize = view.getUint32(end + 12, true)
  let offset = view.getUint32(end + 16, true)
  if (count === 0xffff || offset === 0xffffffff || centralSize === 0xffffffff) throw new Error('ZIP64 não é suportado.')
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0
    || view.getUint16(end + 8, true) !== count || offset + centralSize !== end) {
    throw new Error('Diretório ZIP inválido ou multi-volume.')
  }
  if (count > BACKUP_LIMITS.files) throw new Error('ZIP excede o limite de arquivos.')
  const result: Array<{ name: string; size: number }> = []
  const names = new Set<string>()
  let total = 0
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4b
      || bytes[offset + 2] !== 0x01 || bytes[offset + 3] !== 0x02) {
      throw new Error('Diretório ZIP inválido.')
    }
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const crc = view.getUint32(offset + 16, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const size = view.getUint32(offset + 24, true)
    const localOffset = view.getUint32(offset + 42, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength
    if (recordEnd > end || compressedSize === 0xffffffff || size === 0xffffffff
      || (flags & 0x0009) !== 0 || (method !== 0 && method !== 8)) {
      throw new Error('Entrada ZIP não suportada.')
    }
    const name = strFromU8(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (names.has(name)) throw new Error(`Entrada duplicada no ZIP: ${name}.`)
    if (localOffset + 30 > offset || bytes[localOffset] !== 0x50 || bytes[localOffset + 1] !== 0x4b
      || bytes[localOffset + 2] !== 0x03 || bytes[localOffset + 3] !== 0x04
      || view.getUint16(localOffset + 6, true) !== flags || view.getUint16(localOffset + 8, true) !== method
      || view.getUint32(localOffset + 14, true) !== crc || view.getUint32(localOffset + 18, true) !== compressedSize
      || view.getUint32(localOffset + 22, true) !== size) {
      throw new Error('Cabeçalho local e central divergentes no ZIP.')
    }
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    if (localOffset + 30 + localNameLength + localExtraLength + compressedSize > offset
      || strFromU8(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)) !== name) {
      throw new Error('Cabeçalho local e central divergentes no ZIP.')
    }
    names.add(name)
    total += size
    if (total > BACKUP_LIMITS.uncompressedBytes) throw new Error('ZIP excede o limite descompactado.')
    result.push({ name, size })
    offset = recordEnd
  }
  if (offset !== end) throw new Error('Diretório ZIP inválido.')
  return result
}

function viewUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function unzipBounded(bytes: Uint8Array, directory: Array<{ name: string; size: number }>): Record<string, Uint8Array> {
  const declared = new Map(directory.map((entry) => [entry.name, entry]))
  const entries: Record<string, Uint8Array> = {}
  const seen = new Set<string>()
  let completed = 0
  let totalActual = 0
  const unzipper = new Unzip((file) => {
    const expected = declared.get(file.name)
    if (!expected || seen.has(file.name)) throw new Error('Entrada ZIP inválida ou duplicada.')
    seen.add(file.name)
    if (file.originalSize !== undefined && file.originalSize !== expected.size) {
      throw new Error('Tamanho descompactado divergente no ZIP.')
    }
    const chunks: Uint8Array[] = []
    let fileSize = 0
    file.ondata = (error, chunk, final) => {
      if (error) throw error
      const nextSize = fileSize + chunk.byteLength
      if (nextSize > expected.size || totalActual + chunk.byteLength > BACKUP_LIMITS.uncompressedBytes) {
        throw new Error(nextSize > expected.size
          ? 'Tamanho descompactado divergente no ZIP.'
          : 'ZIP excede o limite descompactado.')
      }
      fileSize = nextSize
      totalActual += chunk.byteLength
      chunks.push(chunk)
      if (final) {
        if (fileSize !== expected.size) throw new Error('Tamanho descompactado divergente no ZIP.')
        entries[file.name] = concatU8(chunks, fileSize)
        completed += 1
      }
    }
    file.start()
  })
  unzipper.register(UnzipInflate)
  unzipper.register(UnzipPassThrough)
  for (let offset = 0; offset < bytes.byteLength; offset += 1024) {
    unzipper.push(bytes.subarray(offset, Math.min(offset + 1024, bytes.byteLength)), offset + 1024 >= bytes.byteLength)
  }
  if (seen.size !== directory.length || completed !== directory.length) throw new Error('ZIP inválido ou incompleto.')
  return entries
}

export async function createBackupPackage(
  tables: Record<string, Array<Record<string, unknown>>>,
  ownerId: string,
  createdAt: string,
): Promise<BackupPackage> {
  const files: BackupManifest['files'] = []
  const csvText: Record<string, string> = {}
  let totalRows = 0
  let uncompressedBytes = 0
  for (const definition of BACKUP_TABLES) {
    const rows = tables[definition.table] ?? []
    if (rows.length > BACKUP_LIMITS.rows) throw new Error('Backup excede o limite de linhas.')
    totalRows += rows.length
    if (totalRows > BACKUP_LIMITS.rows) throw new Error('Backup excede o limite de linhas.')
    const encoded = encodeCsv(definition, rows)
    uncompressedBytes += encoded.bytes.byteLength
    if (uncompressedBytes > BACKUP_LIMITS.uncompressedBytes) throw new Error('Backup excede o limite descompactado de 50 MiB.')
    files.push({ name: definition.file, rows: rows.length, sha256: await sha256Hex(encoded.bytes), columns: [...definition.columns] })
    csvText[definition.file] = encoded.text
  }
  const manifest: BackupManifest = {
    format: 'ber-crm-backup', version: 1, createdAt, ownerId, files, totalRows,
  }
  uncompressedBytes += new TextEncoder().encode(JSON.stringify(manifest, null, 2)).byteLength
  if (uncompressedBytes > BACKUP_LIMITS.uncompressedBytes) throw new Error('Backup excede o limite descompactado de 50 MiB.')
  return { manifest, tables, csvText }
}

export async function createBackupArchive(pkg: BackupPackage): Promise<Uint8Array> {
  const entries = Object.fromEntries(BACKUP_TABLES.map((definition) => [definition.file, strToU8(pkg.csvText[definition.file])]))
  entries['manifest.json'] = strToU8(JSON.stringify(pkg.manifest, null, 2))
  const uncompressedBytes = Object.values(entries).reduce((total, bytes) => total + bytes.byteLength, 0)
  if (uncompressedBytes > BACKUP_LIMITS.uncompressedBytes) throw new Error('Backup excede o limite descompactado de 50 MiB.')
  const result = zipSync(entries, { level: 6 })
  if (result.byteLength > BACKUP_LIMITS.zipBytes) throw new Error('ZIP excede o limite de 25 MiB.')
  return result
}

function parseCsv(bytes: Uint8Array, definition: BackupTableDefinition): Array<Record<string, unknown>> {
  const text = strFromU8(bytes)
  if (!text.startsWith('\uFEFF')) throw new Error(`BOM ausente em ${definition.file}.`)
  const parsed = Papa.parse(text.slice(1), {
    delimiter: ';', header: true, skipEmptyLines: 'greedy', transformHeader: (header) => header.trim(),
  })
  if (parsed.errors.length > 0) throw new Error(`CSV inválido em ${definition.file}.`)
  const headers = definition.columns.map(headerFor)
  if (!Array.isArray(parsed.meta.fields) || parsed.meta.fields.length !== headers.length
    || parsed.meta.fields.some((field, index) => field !== headers[index])) {
    throw new Error(`Colunas inválidas em ${definition.file}.`)
  }
  return parsed.data.map((raw) => {
    const values = raw as Record<string, string>
    const row: Record<string, unknown> = {}
    for (let index = 0; index < definition.columns.length; index += 1) {
      const column = definition.columns[index]
      const value = fromCsvCell(values[headers[index]])
      try {
        row[column] = JSON_COLUMNS.has(column) && value !== null ? JSON.parse(String(value)) : value
      } catch {
        throw new Error(`JSON inválido em ${definition.file}, coluna ${column}.`)
      }
    }
    return row
  })
}

export async function parseBackupArchive(bytes: Uint8Array, expectedOwnerId: string): Promise<BackupPackage> {
  if (bytes.byteLength > BACKUP_LIMITS.zipBytes) throw new Error('ZIP excede o limite de 25 MiB.')
  const directory = zipDirectory(bytes)
  const expectedNames = new Set(['manifest.json', ...BACKUP_TABLES.map((definition) => definition.file)])
  if (directory.some((entry) => !expectedNames.has(entry.name)) || directory.length !== expectedNames.size) {
    throw new Error('O ZIP deve conter somente o manifesto e os CSV allowlisted.')
  }
  const entries = unzipBounded(bytes, directory)
  const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as BackupManifest
  if (manifest.format !== 'ber-crm-backup' || manifest.version !== 1
    || manifest.ownerId !== expectedOwnerId || !Number.isSafeInteger(manifest.totalRows)
    || manifest.totalRows < 0 || manifest.totalRows > BACKUP_LIMITS.rows
    || !Array.isArray(manifest.files) || manifest.files.length !== BACKUP_TABLES.length) {
    throw new Error('Manifesto inválido ou de outro proprietário.')
  }
  const tables = emptyBackupTables()
  const csvText: Record<string, string> = {}
  const seen = new Set<string>()
  let totalRows = 0
  for (const [index, file] of manifest.files.entries()) {
    const definition = BACKUP_TABLES[index]
    if (!definition || file.name !== definition.file || seen.has(file.name) || file.rows !== Math.trunc(file.rows) || file.rows < 0
      || file.sha256 === '0'.repeat(64) || file.sha256.length !== 64 || !/^[0-9a-f]{64}$/.test(file.sha256)
      || !Array.isArray(file.columns) || file.columns.length !== definition.columns.length
      || file.columns.some((column, index) => column !== definition.columns[index])) {
      throw new Error(`Colunas ou hashes inválidos em ${file.name}.`)
    }
    seen.add(file.name)
    const csv = entries[file.name]
    if (!csv) throw new Error(`Arquivo ausente: ${file.name}.`)
    if (await sha256Hex(csv) !== file.sha256) throw new Error(`Hash do arquivo ${file.name} não confere.`)
    const text = strFromU8(csv)
    const rows = parseCsv(csv, definition)
    if (rows.length !== file.rows) throw new Error(`Contagem de linhas inválida em ${file.name}.`)
    if (encodeCsv(definition, rows).text !== text) throw new Error(`Ordem ou conteúdo canônico divergente em ${file.name}.`)
    totalRows += rows.length
    tables[definition.table] = rows
    csvText[file.name] = text
  }
  if (totalRows !== manifest.totalRows || totalRows > BACKUP_LIMITS.rows) throw new Error('Limite total de linhas excedido.')
  return { manifest, tables, csvText }
}
```

- [ ] **Step 5: GREEN e commit**

```bash
npm test -- src/lib/backupFormat.test.ts
git diff --check
git add package.json package-lock.json src/types/backup.ts src/lib/backupFormat.ts src/lib/backupFormat.test.ts
git commit -m "feat: criar formato local e verificado de backup"
```

Esperado: round-trip preserva valores, hashes detectam adulteração, ZIP/linhas/colunas/owner têm limites estritos e não há campos de credencial no registry.

---

### Task 8: Exportar snapshot paginado do proprietário

**Files:**

- Create: `src/services/backupService.ts`
- Create: `src/services/backupService.test.ts`

**Interfaces consumed:**

- `requireSupabase(): SupabaseClient`
- `throwDbError(error: unknown): void`
- `BACKUP_TABLES: readonly BackupTableDefinition[]`
- `createBackupPackage(tables: Record<string, Array<Record<string, unknown>>>, ownerId: string, createdAt: string): Promise<BackupPackage>`
- `createBackupArchive(pkg: BackupPackage): Promise<Uint8Array>`
- `parseBackupArchive(bytes: Uint8Array, expectedOwnerId: string): Promise<BackupPackage>`
- `BACKUP_LIMITS` com `rows`, `zipBytes` e `rpcBytes`
- `BackupPackage`, `RestorePreview`, `BackupDiagnostics` e `RestoreResult` da Task 7

**Interfaces produced:**

- `exportSnapshot(): Promise<BackupPackage>`
- `exportBackup(): Promise<Blob>`
- `importBackupFile(file: File): Promise<BackupPackage>`
- `previewRestore(pkg: BackupPackage): Promise<RestorePreview>`
- `restoreBackup(pkg: BackupPackage, previewHash: string): Promise<RestoreResult>`
- `getDiagnostics(): Promise<BackupDiagnostics>`

- [ ] **Step 1: Testes RED do serviço**

```ts
// src/services/backupService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getUser, from, rpc } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/db', () => ({
  requireSupabase: () => ({ auth: { getUser }, from, rpc }),
  throwDbError: (error: unknown) => { if (error) throw error },
}))

import { BACKUP_LIMITS, type BackupPackage } from '../types/backup'
import { createBackupPackage, emptyBackupTables } from '../lib/backupFormat'
import { exportBackup, previewRestore, restoreBackup, getDiagnostics } from './backupService'

const owner = '11111111-1111-4111-8111-111111111111'
const createdAt = '2026-11-26T12:00:00.000Z'
const previewHash = 'a'.repeat(64)

function leadRow(): Record<string, unknown> {
  return {
    id: '22222222-2222-4222-8222-222222222222', owner_id: owner, name: 'Lead real de teste',
    responsible_name: null, niche: null, phone: null, whatsapp: null, email: null, cnpj: null,
    instagram: null, facebook: null, website: null, menu_url: null, catalog_url: null, maps_url: null,
    country: 'Brasil', state: null, city: null, district: null, address: null, zip_code: null,
    has_website: 'unverified', has_instagram: 'unverified', has_facebook: 'unverified',
    has_digital_menu: 'unverified', has_digital_catalog: 'unverified', has_landing_page: 'unverified',
    has_business_whatsapp: 'unverified', status: 'novo', offered_service: null, notes: null,
    source: null, next_contact_at: null, last_verified_at: null, estimated_value: '0.00',
    negotiated_value: '0.00', contracted_value: '0.00', received_value: '0.00', score: 0,
    priority: 'baixa', needs: [], score_reasons: [], created_at: createdAt, updated_at: createdAt,
  }
}

async function canonicalPackage(): Promise<BackupPackage> {
  return createBackupPackage(emptyBackupTables(), owner, createdAt)
}

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: owner } }, error: null })
})

describe('backupService', () => {
  it('exporta em páginas, paginação por owner e nunca seleciona profiles/auth', async () => {
    let currentTable = ''
    const range = vi.fn(() => Promise.resolve({
      data: currentTable === 'leads' && range.mock.calls.length === 1 ? [leadRow()] : [], error: null,
    }))
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range }
    query.select.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.order.mockReturnValue(query)
    from.mockImplementation((table: string) => { currentTable = table; return query })
    const blob = await exportBackup()
    expect(blob.type).toBe('application/zip')
    expect(query.eq).toHaveBeenCalledWith('owner_id', owner)
    expect(range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(from.mock.calls.every(([table]) => table !== 'profiles' && table !== 'auth.users')).toBe(true)
    expect(query.select.mock.calls.every(([columns]) => !String(columns).includes('access_token'))).toBe(true)
  })

  it('envia manifest, tabelas e CSV canônicos à prévia e exige hash/confirmação no restore', async () => {
    const pkg = await canonicalPackage()
    expect(pkg.manifest.files.length).toBeGreaterThan(0)
    expect(pkg.csvText.leads.startsWith('\uFEFF')).toBe(true)
    rpc.mockResolvedValueOnce({ data: { preview_id: previewHash, package_hash: previewHash, can_restore: true,
      totals: { new: 1, identical: 0, conflict: 0 }, tables: [], issues: [] }, error: null })
    const preview = await previewRestore(pkg)
    expect(preview.canRestore).toBe(true)
    expect(preview.packageHash).toBe(previewHash)
    expect(rpc).toHaveBeenCalledWith('preview_backup_restore', { p_package: pkg })

    rpc.mockResolvedValueOnce({ data: { inserted: { leads: 1 }, audit_event_id: 'audit' }, error: null })
    await restoreBackup(pkg, preview.packageHash)
    expect(rpc).toHaveBeenLastCalledWith('restore_backup', {
      p_package: pkg, p_preview_hash: previewHash, p_confirmation: 'RESTAURAR',
    })
  })

  it('aplica 4 MiB somente ao payload RPC e valida o hash da prévia', async () => {
    const pkg = await canonicalPackage()
    pkg.csvText.leads = 'x'.repeat(BACKUP_LIMITS.rpcBytes + 1)
    await expect(previewRestore(pkg)).rejects.toThrow('4 MiB')
    expect(rpc).not.toHaveBeenCalled()
    await expect(restoreBackup(await canonicalPackage(), 'invalid')).rejects.toThrow('Hash de prévia inválido')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('converte diagnóstico snake_case e rejeita sessão ausente', async () => {
    const limits = { rows: 50_000, zipBytes: 1, uncompressedBytes: 1, rpcBytes: 1, fieldBytes: 1, files: 1, columns: 1 }
    rpc.mockResolvedValue({ data: { generated_at: 'now', schema_version: 3,
      checks: [{ code: 'orphan.leads', severity: 'critical', count: 1, sample_ids: ['22222222-2222-4222-8222-222222222222'] }],
      limits }, error: null })
    const result = await getDiagnostics()
    expect(result.generatedAt).toBe('now')
    expect(result.checks).toEqual([{ code: 'orphan.leads', severity: 'critical', count: 1,
      sampleIds: ['22222222-2222-4222-8222-222222222222'] }])
    expect(result.limits).toEqual(limits)
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(exportBackup()).rejects.toThrow('Sua sessão expirou')
  })
})
```

Comando RED:

```bash
npm test -- src/services/backupService.test.ts
```

Esperado: serviço não existe.

- [ ] **Step 2: Criar o serviço**

```ts
// src/services/backupService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import { BACKUP_LIMITS, type BackupDiagnostics, type BackupPackage, type RestorePreview, type RestoreResult } from '../types/backup'
import { BACKUP_TABLES, createBackupArchive, createBackupPackage, emptyBackupTables, parseBackupArchive } from '../lib/backupFormat'

function objectData<T>(data: unknown, message: string): T {
  const value = Array.isArray(data) ? data[0] : data
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message)
  return value as T
}

async function ownerId(): Promise<string> {
  const { data, error } = await requireSupabase().auth.getUser()
  if (error) throw new Error('Não foi possível validar sua sessão. Entre novamente.')
  const id = data.user?.id
  if (!id) throw new Error('Sua sessão expirou. Entre novamente.')
  return id
}

function checkPackageSize(pkg: BackupPackage): void {
  if (new TextEncoder().encode(JSON.stringify(pkg)).byteLength > BACKUP_LIMITS.rpcBytes) {
    throw new Error('Pacote excede 4 MiB. Exporte um backup menor.')
  }
}

export async function exportSnapshot(): Promise<BackupPackage> {
  const owner = await ownerId()
  const client = requireSupabase()
  const tables = emptyBackupTables()
  let totalRows = 0
  for (const definition of BACKUP_TABLES) {
    const rows: Array<Record<string, unknown>> = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from(definition.table)
        .select(definition.columns.join(','))
        .eq('owner_id', owner)
        .order(definition.key)
        .range(offset, offset + 999)
      throwDbError(error)
      const page = (data ?? []) as Array<Record<string, unknown>>
      rows.push(...page)
      totalRows += page.length
      if (totalRows > BACKUP_LIMITS.rows) throw new Error('Backup excede 50.000 linhas.')
      if (page.length < 1000) break
    }
    tables[definition.table] = rows
  }
  return createBackupPackage(tables, owner, new Date().toISOString())
}

export async function exportBackup(): Promise<Blob> {
  const pkg = await exportSnapshot()
  const bytes = await createBackupArchive(pkg)
  return new Blob([bytes.slice()], { type: 'application/zip' })
}

export async function importBackupFile(file: File): Promise<BackupPackage> {
  const owner = await ownerId()
  if (file.size > BACKUP_LIMITS.zipBytes) throw new Error('ZIP excede o limite de 25 MiB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  return parseBackupArchive(bytes, owner)
}

export async function previewRestore(pkg: BackupPackage): Promise<RestorePreview> {
  checkPackageSize(pkg)
  const { data, error } = await requireSupabase().rpc('preview_backup_restore', { p_package: pkg })
  throwDbError(error)
  const row = objectData<{
    preview_id: string; package_hash: string; can_restore: boolean;
    totals: RestorePreview['totals']; tables: Array<{ table: string; new: number; identical: number; conflict: number }>; issues: string[];
  }>(data, 'Prévia de restore inválida.')
  if (row.preview_id !== row.package_hash || !/^[0-9a-f]{64}$/.test(row.package_hash)
    || !Array.isArray(row.issues) || !Array.isArray(row.tables)) throw new Error('Prévia de restore inválida.')
  return {
    previewId: row.preview_id, packageHash: row.package_hash, canRestore: row.can_restore,
    totals: row.totals, tables: row.tables, issues: row.issues,
  }
}

export async function restoreBackup(pkg: BackupPackage, previewHash: string): Promise<RestoreResult> {
  checkPackageSize(pkg)
  if (!/^[0-9a-f]{64}$/.test(previewHash)) throw new Error('Hash de prévia inválido.')
  const { data, error } = await requireSupabase().rpc('restore_backup', {
    p_package: pkg, p_preview_hash: previewHash, p_confirmation: 'RESTAURAR',
  })
  throwDbError(error)
  const row = objectData<{ inserted: Record<string, number>; audit_event_id: string }>(data, 'Resposta de restore inválida.')
  if (!row.inserted || typeof row.inserted !== 'object' || !row.audit_event_id) throw new Error('Resposta de restore inválida.')
  return { inserted: row.inserted, auditEventId: row.audit_event_id }
}

export async function getDiagnostics(): Promise<BackupDiagnostics> {
  await ownerId()
  const { data, error } = await requireSupabase().rpc('get_backup_diagnostics')
  throwDbError(error)
  const row = objectData<{
    generated_at: string; schema_version: number;
    checks: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; count: number; sample_ids: string[] }>;
    limits: BackupDiagnostics['limits'];
  }>(data, 'Diagnóstico inválido.')
  if (!Array.isArray(row.checks) || !row.limits || row.checks.some((check) =>
    typeof check.code !== 'string' || !['info', 'warning', 'critical'].includes(check.severity)
    || !Number.isSafeInteger(check.count) || check.count < 0 || !Array.isArray(check.sample_ids)
    || check.sample_ids.some((id) => typeof id !== 'string')
    || !Object.values(row.limits).every((limit) => Number.isSafeInteger(limit) && limit > 0))) {
    throw new Error('Diagnóstico inválido.')
  }
  return {
    generatedAt: row.generated_at, schemaVersion: row.schema_version,
    checks: row.checks.map((check) => ({ code: check.code, severity: check.severity,
      count: check.count, sampleIds: check.sample_ids })),
    limits: row.limits,
  }
}
```

- [ ] **Step 3: GREEN e commit**

```bash
npm test -- src/services/backupService.test.ts
git diff --check
git add src/services/backupService.ts src/services/backupService.test.ts
git commit -m "feat: exportar backup paginado do proprietario"
```

Esperado: todas as consultas filtram `owner_id`, usam página de até 1000, param em 50.000 linhas e não leem `profiles`/`auth`.

### Task 9: Preview read-only e restore transacional no PostgreSQL

**Files:**

- Create: `supabase/migrations/0012_etapa3_backup.sql`
- Create: `supabase/tests/etapa3_backup.sql`

**Interfaces consumed:**

- `0001`–`0011`, incluindo `public.contracts`, `public.projects`, `public.project_tasks`, `public.contract_installments`, `public.financial_payments`, `public.financial_payment_allocations`, `public.financial_expenses`, `public.lead_client_links`, `public.validate_user_preferences(jsonb)`, `public.canonical_phone(text)`, `public.record_payment(jsonb)` e `public.reorder_project_tasks(uuid,uuid[])`.
- `BackupPackage` e os limites da Task 7: chaves exatas `manifest`, `tables` e `csvText`; 18 tabelas allowlisted; 25 MiB de ZIP; 50 MiB descompactados; 4 MiB de payload; 1 MiB por campo; 32 arquivos; 50.000 linhas; 64 colunas.
- Auditoria em runtime: `0013` deve criar `public.audit_events` e `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid` antes de qualquer execução do restore.

**Interfaces produced:**

- `public.backup_table_registry(table_name text, file_name text, key_column text, columns text[], required_columns text[], insert_order integer)`
- `public.backup_csv_for_table(p_table text, p_rows jsonb) returns text`
- `public.validate_backup_package(p_package jsonb) returns void`
- `public.stage_backup_package(p_package jsonb) returns void`
- `public.classify_backup_package() returns jsonb`
- `public.preview_backup_restore(p_package jsonb) returns jsonb`
- `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`
- `public.restore_backup_financial_rows() returns jsonb`
- `public.lock_backup_restore() returns void`
- `public.get_backup_diagnostics() returns jsonb`
- Helpers internos `backup_json_canonical`, `backup_header`, `backup_csv_cell`, `backup_package_hash`, `add_backup_issue`, `backup_id_exists`, `backup_unique_issues`, `backup_relation_issues`, `backup_semantic_issues`, `backup_url_decode`, `backup_maps_url_valid`, `backup_preferences_valid`, `backup_service_prices_valid`, `backup_diagnostic_definition` e `backup_owner_exists`. `lock_backup_restore` e os validadores/formatadores internos não recebem EXECUTE de `authenticated`, exceto `backup_url_decode`, `backup_maps_url_valid`, `backup_preferences_valid`, `backup_service_prices_valid` e `backup_owner_exists`. `backup_diagnostic_definition` é chamado somente pelo agregador `security definer`.

`0012` não cria `audit_events`, `write_audit_event` nem triggers genéricas de auditoria. `0013` é seu único dono.

- [ ] **Step 1: Escrever o teste SQL RED com dois proprietários**

```sql
-- supabase/tests/etapa3_backup.sql
begin;

create or replace function pg_temp.etapa3_test_row(p_table text, p_row jsonb)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(column_name, p_row -> column_name), '{}'::jsonb)
  from public.backup_table_registry r,
    unnest(r.columns) as column_name
  where r.table_name = p_table;
$$;

create or replace function pg_temp.etapa3_test_package(p_owner uuid, p_tables jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_temp, public
as $$
declare
  v_tables jsonb;
  v_files jsonb;
  v_csv jsonb;
  v_total int := 0;
begin
  select jsonb_object_agg(table_name, '[]'::jsonb) into v_tables from public.backup_table_registry;
  v_tables := v_tables || p_tables;
  select jsonb_object_agg(file_name, public.backup_csv_for_table(table_name, v_tables -> table_name))
    into v_csv from public.backup_table_registry;
  select jsonb_agg(jsonb_build_object(
    'name', file_name,
    'rows', jsonb_array_length(v_tables -> table_name),
    'sha256', encode(sha256(convert_to(v_csv ->> file_name, 'UTF8')), 'hex'),
    'columns', columns
  ) order by insert_order) into v_files from public.backup_table_registry;
  select sum(jsonb_array_length(value)) into v_total from jsonb_each(v_tables);
  return jsonb_build_object(
    'manifest', jsonb_build_object(
      'format', 'ber-crm-backup', 'version', 1, 'createdAt', '2026-11-26T12:00:00Z',
      'ownerId', p_owner, 'files', v_files, 'totalRows', v_total
    ),
    'tables', v_tables,
    'csvText', v_csv
  );
end;
$$;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_existing public.leads%rowtype;
  v_new_id uuid := gen_random_uuid();
  v_other_id uuid := gen_random_uuid();
  v_row jsonb;
  v_package jsonb;
  v_preview jsonb;
  v_result jsonb;
  v_count int;
  v_normal_updated_at timestamptz;
begin
  insert into auth.users (id, email) values
    (v_owner, 'etapa3-backup-owner-' || v_owner::text || '@example.test'),
    (v_other, 'etapa3-backup-other-' || v_other::text || '@example.test');

  reset role;
  insert into public.leads (id, owner_id, name, created_at, updated_at)
  values (gen_random_uuid(), v_owner, 'Lead existente', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z');
  insert into public.leads (id, owner_id, name) values (v_other_id, v_other, 'Lead do outro dono');
  set local role authenticated;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select * into v_existing from public.leads where owner_id = v_owner;
  v_row := pg_temp.etapa3_test_row('leads', to_jsonb(v_existing));

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(v_row)));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not true
    or (v_preview -> 'totals' ->> 'identical')::int <> 1 then
    raise exception 'Prévia não classificou linha idêntica corretamente.';
  end if;

  v_row := pg_temp.etapa3_test_row('leads',
    to_jsonb(v_existing) || jsonb_build_object('name', 'Conflito')
  );
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(v_row)));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or (v_preview -> 'totals' ->> 'conflict')::int <> 1 then
    raise exception 'Prévia não abortou conflito.';
  end if;
  if (select name from public.leads where id = v_existing.id) <> 'Lead existente' then
    raise exception 'Prévia sobrescreveu dado persistente.';
  end if;

  v_row := pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
    'id', v_other_id, 'name', 'Colisão entre donos'
  ));
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(v_row)));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false then
    raise exception 'ID de outro proprietário não abortou a prévia.';
  end if;

  v_row := pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
    'id', gen_random_uuid(), 'name', 'Lead telefone A', 'phone', '(11) 99999-0001'));
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    v_row,
    pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Lead telefone B', 'whatsapp', '11999990001'))
  )));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Telefone ou WhatsApp canônico%') then
    raise exception 'Duplicidade canônica entre telefone e WhatsApp de leads não foi bloqueada.';
  end if;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Lead CNPJ A', 'cnpj', '11.111.111/0001-81')),
    pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Lead CNPJ B', 'cnpj', '11111111000181'))
  )));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%CNPJ canônico de lead%') then
    raise exception 'Duplicidade canônica de CNPJ de leads não foi bloqueada.';
  end if;

  v_row := pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object('id', gen_random_uuid()));
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(v_row, v_row)));
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Chave primária duplicada no pacote foi aceita.';
  exception when unique_violation then null;
  end;

  v_row := pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
    'id', v_new_id, 'name', 'Lead restaurado', 'created_at', '2019-05-01T00:00:00Z',
    'updated_at', '2019-05-02T00:00:00Z'
  ));
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(v_row)));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not true then raise exception 'Pacote válido foi rejeitado.'; end if;

  begin
    perform public.restore_backup(v_package, repeat('0', 64), 'RESTAURAR');
    raise exception 'Hash de prévia inválido foi aceito.';
  exception when others then
    if sqlerrm <> 'Hash da prévia não confere.' then raise; end if;
  end;

  begin
    perform public.restore_backup(v_package, null, 'RESTAURAR');
    raise exception 'Hash de prévia nulo foi aceito.';
  exception when others then
    if sqlerrm <> 'Hash da prévia não confere.' then raise; end if;
  end;

  begin
    perform public.restore_backup(v_package, v_preview ->> 'package_hash', null);
    raise exception 'Confirmação nula foi aceita.';
  exception when others then
    if sqlerrm <> 'Confirmação inválida.' then raise; end if;
  end;

  v_result := public.restore_backup(v_package, v_preview ->> 'package_hash', 'RESTAURAR');
  if (v_result -> 'inserted' ->> 'leads')::int <> 1 then raise exception 'Restore não inseriu a lead.'; end if;
  select * into v_existing from public.leads where id = v_new_id;
  if v_existing.created_at <> '2019-05-01T00:00:00Z'::timestamptz
    or v_existing.updated_at <> '2019-05-02T00:00:00Z'::timestamptz then
    raise exception 'Timestamps históricos não foram preservados.';
  end if;
  update public.leads set notes = 'Atualização normal sintética' where id = v_new_id
    returning updated_at into v_normal_updated_at;
  if v_normal_updated_at <= v_existing.updated_at then
    raise exception 'Operação normal deixou de atualizar updated_at.';
  end if;
  select count(*) into v_count from public.audit_events
    where owner_id = v_owner and action = 'backup.restore';
  if v_count <> 1 then raise exception 'Auditoria final do restore ausente.'; end if;
  if not exists (
    select 1 from public.audit_events a
    where a.owner_id = v_owner and a.actor_id = v_owner and a.action = 'backup.restore'
      and a.entity_type = 'backup' and a.entity_id = v_preview ->> 'package_hash'
      and public.jsonb_object_has_exact_keys(a.metadata, array['backup_id','restore_id','count'])
      and a.metadata ->> 'backup_id' = v_preview ->> 'package_hash'
      and pg_catalog.jsonb_typeof(a.metadata -> 'restore_id') = 'string'
      and a.metadata ->> 'restore_id' ~ '^[0-9a-f-]{36}$'
      and pg_catalog.jsonb_typeof(a.metadata -> 'count') = 'number'
      and (a.metadata ->> 'count')::int between 0 and 50000
  ) then raise exception 'Contrato de auditoria mínima do restore inválido.'; end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Outro proprietário conseguiu prévia do pacote.';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  v_package := pg_temp.etapa3_test_package(v_owner);
  v_package := jsonb_set(v_package, '{manifest,totalRows}', '50001');
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Limite de linhas foi ignorado.';
  exception when others then
    if sqlerrm <> 'Pacote excede 50.000 linhas.' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner);
  v_package := jsonb_set(v_package, '{manifest,totalRows}', 'null'::jsonb);
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Manifesto com totalRows nulo foi aceito.';
  exception when others then
    if sqlerrm not like '%Manifesto inválido%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner);
  v_package := jsonb_set(v_package, '{manifest,files,0,rows}', 'null'::jsonb);
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Manifesto com rows nulo foi aceito.';
  exception when others then
    if sqlerrm not like '%colunas inválidos no manifesto%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner);
  v_package := jsonb_set(v_package, '{manifest,files,0,sha256}', 'null'::jsonb);
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Manifesto com SHA-256 nulo foi aceito.';
  exception when others then
    if sqlerrm not like '%colunas inválidos no manifesto%' then raise; end if;
  end;

  if has_table_privilege('authenticated', 'public.financial_payments', 'INSERT') then
    raise exception 'authenticated recebeu INSERT direto em financial_payments.';
  end if;

  v_row := pg_temp.etapa3_test_row('leads', to_jsonb(v_existing) || jsonb_build_object(
    'id', gen_random_uuid(), 'name', 'Rollback por auditoria'
  ));
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(v_row)));
  v_preview := public.preview_backup_restore(v_package);
  create or replace function pg_temp.reject_restore_audit()
  returns trigger language plpgsql as $$
  begin
    if new.action = 'backup.restore' then raise exception 'Falha audit de teste.'; end if;
    return new;
  end;
  $$;
  reset role;
  create trigger audit_reject_restore_test before insert on public.audit_events
    for each row execute function pg_temp.reject_restore_audit();
  set local role authenticated;
  begin
    perform public.restore_backup(v_package, v_preview ->> 'package_hash', 'RESTAURAR');
    raise exception 'Restore continuou sem auditoria final.';
  exception when others then
    if sqlerrm <> 'Falha audit de teste.' then raise; end if;
  end;
  if exists (select 1 from public.leads where id = (v_row ->> 'id')::uuid) then
    raise exception 'Falha de auditoria não reverteu o restore.';
  end if;
  reset role;
  drop trigger audit_reject_restore_test on public.audit_events;
  set local role authenticated;
end
$$;

reset role;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_contract uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_installment uuid := gen_random_uuid();
  v_expense_category uuid := gen_random_uuid();
  v_revenue_category uuid := gen_random_uuid();
  v_receipt uuid := gen_random_uuid();
  v_allocation uuid := gen_random_uuid();
  v_expense uuid := gen_random_uuid();
  v_lead uuid := gen_random_uuid();
  v_preview_lead uuid := gen_random_uuid();
  v_preview_followup uuid := gen_random_uuid();
  v_def record;
  v_rows jsonb;
  v_base_tables jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_package jsonb;
  v_preview jsonb;
  v_result jsonb;
  v_count int;
  v_before int;
  v_csv text;
  v_lines text[];
  v_function text;
  v_canonical_lock text;
  v_positions int[];
begin
  insert into auth.users (id, email) values
    (v_owner, 'etapa3-backup-fin-owner-' || v_owner::text || '@example.test'),
    (v_other, 'etapa3-backup-fin-other-' || v_other::text || '@example.test');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('ber.restore', 'on', true);
  insert into public.clients (id, owner_id, creation_key, name, status, created_at, updated_at)
    values (v_client, v_owner, gen_random_uuid(), 'Cliente sintético de backup', 'active',
      '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z');
  insert into public.contracts (id, owner_id, client_id, creation_key, service, total_value,
    contracted_at, status, created_at, updated_at)
    values (v_contract, v_owner, v_client, gen_random_uuid(), 'Site', 100.00,
      '2020-01-03', 'active', '2020-01-03T00:00:00Z', '2020-01-04T00:00:00Z');
  insert into public.projects (id, owner_id, client_id, contract_id, name, service,
    contracted_value, status, priority, created_at, updated_at)
    values (v_project, v_owner, v_client, v_contract, 'Projeto sintético', 'Site', 60.00,
      'not_started', 'medium', '2020-01-04T00:00:00Z', '2020-01-05T00:00:00Z');
  insert into public.contract_installments (id, owner_id, contract_id, position, amount,
    due_date, created_at, updated_at)
    values (v_installment, v_owner, v_contract, 1, 100.00, '2020-02-01',
      '2020-01-04T00:00:00Z', '2020-01-05T00:00:00Z');
  insert into public.expense_categories (id, owner_id, name, created_at, updated_at)
    values (v_expense_category, v_owner, 'Ferramentas', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z');
  insert into public.revenue_categories (id, owner_id, name, created_at, updated_at)
    values (v_revenue_category, v_owner, 'Projetos web', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z');
  insert into public.financial_payments (id, owner_id, contract_id, idempotency_key, type,
    amount, received_at, payment_method, revenue_category_id, created_by, created_at)
    values (v_receipt, v_owner, v_contract, gen_random_uuid(), 'receipt', 100.00,
      '2020-02-01T12:00:00Z', 'pix', v_revenue_category, v_owner, '2020-02-01T12:00:00Z');
  insert into public.financial_payment_allocations (id, owner_id, contract_id, payment_id,
    installment_id, amount, created_at)
    values (v_allocation, v_owner, v_contract, v_receipt, v_installment, 100.00, '2020-02-01T12:00:00Z');
  insert into public.financial_expenses (id, owner_id, description, category_id, amount,
    expense_date, paid_at, status, project_id, contract_id, created_at, updated_at)
    values (v_expense, v_owner, 'Hospedagem sintética', v_expense_category, 10.00,
      '2020-02-02', '2020-02-02T12:00:00Z', 'paid', v_project, v_contract,
      '2020-02-02T00:00:00Z', '2020-02-03T00:00:00Z');
  insert into public.leads (id, owner_id, name, maps_url, status, priority, created_at, updated_at)
    values (v_lead, v_owner, 'Lead com Maps sintético', 'https://maps.app.goo.gl/abc123',
      'novo', 'media', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z');
  insert into public.lead_activities (id, owner_id, lead_id, type, description, user_id, created_at)
    values (gen_random_uuid(), v_owner, v_lead, 'conversao', 'Conversão sintética preservada', v_owner,
      '2020-01-02T00:00:00Z');
  perform set_config('ber.restore', 'off', true);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  for v_def in select * from public.backup_table_registry order by insert_order loop
    execute format(
      'select coalesce(jsonb_agg(pg_temp.etapa3_test_row(%L, to_jsonb(t)) order by t.%I), ''[]''::jsonb) '
      'from public.%I t where t.owner_id = $1', v_def.table_name, v_def.key_column, v_def.table_name
    ) into v_rows using v_owner;
    v_tables := jsonb_set(v_tables, array[v_def.table_name], v_rows, true);
  end loop;
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not true then
    raise exception 'Pacote financeiro completo foi rejeitado: %', v_preview ->> 'issues';
  end if;

  reset role;
  perform set_config('ber.restore', 'on', true);
  delete from public.financial_payment_allocations where id = v_allocation;
  delete from public.financial_payments where id = v_receipt;
  delete from public.financial_expenses where id = v_expense;
  delete from public.contract_installments where id = v_installment;
  delete from public.projects where id = v_project;
  delete from public.contracts where id = v_contract;
  delete from public.clients where id = v_client;
  delete from public.leads where id = v_lead;
  delete from public.expense_categories where id = v_expense_category;
  delete from public.revenue_categories where id = v_revenue_category;
  perform set_config('ber.restore', 'off', true);
  set local role authenticated;

  v_result := public.restore_backup(v_package, v_preview ->> 'package_hash', 'RESTAURAR');
  if (v_result -> 'inserted' ->> 'financial_payments')::int <> 1
    or (v_result -> 'inserted' ->> 'financial_payment_allocations')::int <> 1
    or (v_result -> 'inserted' ->> 'financial_expenses')::int <> 1 then
    raise exception 'Restore financeiro não inseriu a cadeia completa.';
  end if;
  select count(*) into v_count from public.financial_payments p
    join public.financial_payment_allocations a on a.payment_id = p.id
    join public.contract_installments i on i.id = a.installment_id
    where p.id = v_receipt and a.amount = 100.00 and i.amount = 100.00;
  if v_count <> 1 then raise exception 'Pagamento, alocação e parcela restaurados não conferem.'; end if;
  select count(*) into v_count from public.lead_activities
    where owner_id = v_owner and lead_id = v_lead and type = 'conversao';
  if v_count <> 1 then raise exception 'Atividade legítima de conversão não foi restaurada.'; end if;
  select count(*) into v_count from public.audit_events
    where owner_id = v_owner and action = 'backup.restore';
  if v_count <> 1 then raise exception 'Restore financeiro não gerou exatamente um evento final.'; end if;

  v_preview := public.preview_backup_restore(v_package);
  v_result := public.restore_backup(v_package, v_preview ->> 'package_hash', 'RESTAURAR');
  if (v_preview -> 'totals' ->> 'new')::int <> 0
    or (v_preview -> 'totals' ->> 'identical')::int <> (v_package -> 'manifest' ->> 'totalRows')::int
    or exists (select 1 from jsonb_each(v_result -> 'inserted') where value <> '0'::jsonb) then
    raise exception 'Restore idempotente não ignorou linhas idênticas.';
  end if;

  v_base_tables := v_package -> 'tables';
  reset role;
  perform set_config('ber.restore', 'on', true);
  update public.revenue_categories set archived_at = '2020-03-01T00:00:00Z' where id = v_revenue_category;
  perform set_config('ber.restore', 'off', true);
  set local role authenticated;
  v_rows := (select jsonb_agg(case when value ->> 'id' = v_revenue_category::text
    then value || jsonb_build_object('archived_at', '2020-03-01T00:00:00Z') else value end)
    from jsonb_array_elements(v_base_tables -> 'revenue_categories') as row(value));
  v_base_tables := jsonb_set(v_base_tables, '{revenue_categories}', v_rows);
  v_tables := v_base_tables - 'revenue_categories';
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not true then
    raise exception 'Pagamento histórico com categoria arquivada foi rejeitado.';
  end if;

  v_tables := v_base_tables;
  v_rows := pg_temp.etapa3_test_row('financial_payments', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'contract_id', v_contract,
    'idempotency_key', gen_random_uuid(), 'related_payment_id', v_receipt, 'type', 'refund',
    'amount', 101.00, 'received_at', '2020-02-02T12:00:00Z', 'payment_method', 'pix',
    'notes', null, 'revenue_category_id', v_revenue_category, 'created_by', v_owner,
    'created_at', '2020-02-02T12:00:00Z'));
  v_tables := jsonb_set(v_tables, '{financial_payments}', (v_tables -> 'financial_payments') || jsonb_build_array(v_rows));
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Estorno excede%') then
    raise exception 'Estorno acima do recebimento não foi bloqueado.';
  end if;

  v_tables := v_base_tables;
  v_rows := pg_temp.etapa3_test_row('contract_installments', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'contract_id', v_contract,
    'position', 2, 'amount', 1.00, 'due_date', '2020-03-01',
    'created_at', '2020-02-02T12:00:00Z', 'updated_at', '2020-02-02T12:00:00Z'));
  v_tables := jsonb_set(v_tables, '{contract_installments}',
    (v_tables -> 'contract_installments') || jsonb_build_array(v_rows));
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Soma das parcelas%') then
    raise exception 'Soma de parcelas divergente não foi bloqueada.';
  end if;

  v_tables := v_base_tables;
  v_rows := (select jsonb_agg(case when value ->> 'id' = v_lead::text
    then value || jsonb_build_object('maps_url', 'javascript:alert(1)') else value end)
    from jsonb_array_elements(v_tables -> 'leads') as row(value));
  v_tables := jsonb_set(v_tables, '{leads}', v_rows);
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Maps inválido%') then
    raise exception 'Maps inseguro não foi bloqueado.';
  end if;

  v_tables := v_base_tables;
  v_rows := pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0)
    || jsonb_build_object('estimated_value', -1));
  v_tables := jsonb_set(v_tables, '{leads}', jsonb_build_array(v_rows));
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Valores comerciais ou score inválidos%') then
    raise exception 'Valor comercial negativo não foi bloqueado.';
  end if;

  v_tables := v_base_tables;
  v_rows := (select jsonb_agg(case when value ->> 'id' = v_expense_category::text
    then value || jsonb_build_object('name', repeat('x', 61)) else value end)
    from jsonb_array_elements(v_tables -> 'expense_categories') as row(value));
  v_tables := jsonb_set(v_tables, '{expense_categories}', v_rows);
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Nome de categoria inválido%') then
    raise exception 'Nome de categoria acima do limite não foi bloqueado.';
  end if;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0) || jsonb_build_object(
      'id', gen_random_uuid(), 'maps_url', 'https://www.google.com/maps/place/Estabelecimento'))
  )));
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not true then raise exception 'Maps HTTPS válido foi rejeitado.'; end if;

  v_rows := pg_temp.etapa3_test_row('lead_followups', jsonb_build_object(
    'id', v_preview_followup, 'owner_id', v_owner, 'lead_id', v_preview_lead,
    'due_at', '2020-04-01T12:00:00Z', 'status', 'pendente',
    'created_at', '2020-03-01T12:00:00Z', 'updated_at', '2020-03-01T12:00:00Z'));
  v_tables := jsonb_build_object(
    'leads', jsonb_build_array(pg_temp.etapa3_test_row('leads',
      (v_base_tables -> 'leads' -> 0) || jsonb_build_object(
        'id', v_preview_lead, 'next_contact_at', null))),
    'lead_followups', jsonb_build_array(v_rows));
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not false
    or not exists (select 1 from jsonb_array_elements(v_preview -> 'issues') as issue(value)
      where value #>> '{}' like '%Próximo contato diverge%') then
    raise exception 'Próximo contato divergente não foi bloqueado na prévia.';
  end if;
  v_tables := jsonb_set(v_tables, '{leads,0,next_contact_at}', to_jsonb('2020-04-01T12:00:00Z'::timestamptz));
  v_package := pg_temp.etapa3_test_package(v_owner, v_tables);
  v_preview := public.preview_backup_restore(v_package);
  if (v_preview ->> 'can_restore')::bool is not true then
    raise exception 'Pacote coerente de próximo contato foi rejeitado: %', v_preview ->> 'issues';
  end if;

  reset role;
  foreach v_lines in array array[
    'https://maps.app.goo.gl/Abc?x=1', 'https://goo.gl/maps/Abc',
    'https://www.google.com/maps/place/Estabelecimento',
    'https://www.google.com/maps?q=placeid%3Aabc_123',
    'https://maps.google.com/maps?query_place_id=abc&cid=123',
    'http://google.com/maps?cid=123', 'https://www.google.com./maps/place/Test',
    'https://maps.google.com:443/maps/place/Test', 'https://maps.google.com./evil?cid=1'
  ] loop
    if not public.backup_maps_url_valid(v_lines) then
      raise exception 'Maps válido rejeitado: %', v_lines;
    end if;
  end loop;
  foreach v_lines in array array[
    'https://maps.google.com:65536/maps/place/Test',
    'https://maps.google.com:999999999999999999999/maps/place/Test', 'https://maps.app.goo.gl',
    'https://goo.gl/maps/', 'https://www.google.com/maps?Q=placeid:abc',
    'https://www.google.com/maps?q=placeid:%20abc',
    'https://user@maps.google.com/maps/place/Test', 'javascript:alert(1)',
    'https://maps.app.goo.gl../', 'https://www.google.com/maps?cid=abc'
  ] loop
    if public.backup_maps_url_valid(v_lines) then
      raise exception 'Maps inválido aceito: %', v_lines;
    end if;
  end loop;
  set local role authenticated;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0) || jsonb_build_object(
      'id', gen_random_uuid(), 'name', null, 'maps_url', 'https://www.google.com/maps/place/Estabelecimento')))));
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Staging aceitou NOT NULL violado.';
  exception when not_null_violation then null;
  end;

  v_package := jsonb_set(v_package, '{manifest,files,0,sha256}', to_jsonb(repeat('0', 64)));
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Hash zerado foi aceito.';
  exception when others then
    if sqlerrm not like '%inválidos no manifesto%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0)))));
  v_package := jsonb_set(v_package, '{csvText,leads.csv}',
    to_jsonb(replace(v_package -> 'csvText' ->> 'leads.csv', 'Lead com Maps sintético', 'Lead adulterado')));
  v_package := jsonb_set(v_package, '{manifest,files,0,sha256}', to_jsonb(encode(
    sha256(convert_to(v_package -> 'csvText' ->> 'leads.csv', 'UTF8')), 'hex')));
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'CSV divergente com hash recalculado foi aceito.';
  exception when others then
    if sqlerrm not like '%conteúdo canônico divergente%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0)))));
  v_package := jsonb_set(v_package, '{csvText}', v_package -> 'csvText' - 'checks.csv');
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'CSV ausente foi aceito.';
  exception when others then
    if sqlerrm not like '%Tabelas ou CSVs do pacote não correspondem%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0)))));
  v_package := jsonb_set(v_package, '{manifest,files,0,columns}', '["access_token"]'::jsonb);
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Coluna fora da allowlist foi aceita.';
  exception when others then
    if sqlerrm not like '%colunas inválidos no manifesto%' then raise; end if;
  end;

  v_rows := jsonb_build_array(
    pg_temp.etapa3_test_row('lead_digital_checks', jsonb_build_object(
      'id', gen_random_uuid(), 'lead_id', v_lead, 'owner_id', v_owner, 'item', 'instagram',
      'verified', false, 'verified_at', null, 'created_at', '2020-01-01T00:00:00Z')),
    pg_temp.etapa3_test_row('lead_digital_checks', jsonb_build_object(
      'id', gen_random_uuid(), 'lead_id', v_lead, 'owner_id', v_owner, 'item', 'website',
      'verified', true, 'verified_at', '2020-01-02T00:00:00Z', 'created_at', '2020-01-01T00:00:00Z')));
  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object(
    'leads', jsonb_build_array(pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0))),
    'lead_digital_checks', v_rows));
  if right(v_package -> 'csvText' ->> 'checks.csv', 1) <> E'\n' then
    raise exception 'CSV canônico não termina com newline.';
  end if;
  v_lines := regexp_split_to_array(v_package -> 'csvText' ->> 'checks.csv', E'\n');
  v_csv := v_lines[1] || E'\n' || v_lines[3] || E'\n' || v_lines[2] || E'\n';
  v_package := jsonb_set(v_package, '{csvText,checks.csv}', to_jsonb(v_csv));
  v_package := jsonb_set(v_package, '{manifest,files,3,sha256}', to_jsonb(encode(
    sha256(convert_to(v_csv, 'UTF8')), 'hex')));
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Ordem de linhas divergente foi aceita.';
  exception when others then
    if sqlerrm not like '%conteúdo canônico divergente%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner, jsonb_build_object('leads', jsonb_build_array(
    pg_temp.etapa3_test_row('leads', (v_base_tables -> 'leads' -> 0)))));
  begin
    v_package := jsonb_set(v_package, '{tables,leads,0,notes}', to_jsonb(repeat('x', 1048577)));
    perform public.preview_backup_restore(v_package);
    raise exception 'Campo acima de 1 MiB foi aceito.';
  exception when others then
    if sqlerrm not like '%Campo textual excede 1 MiB%' then raise; end if;
  end;

  v_package := pg_temp.etapa3_test_package(v_owner);
  v_package := jsonb_set(v_package, '{csvText,leads.csv}', to_jsonb(repeat('x', 4194305)));
  begin
    perform public.preview_backup_restore(v_package);
    raise exception 'Payload acima de 4 MiB foi aceito.';
  exception when others then
    if sqlerrm not like '%Pacote excede 4 MiB%' then raise; end if;
  end;

  select count(*) into v_before from public.leads where owner_id = v_owner;
  v_result := public.get_backup_diagnostics();
  select count(*) into v_count from public.leads where owner_id = v_owner;
  if v_count <> v_before or v_count <> 1 or jsonb_typeof(v_result -> 'checks') <> 'array'
    or (v_result -> 'limits' ->> 'fieldBytes')::int <> 1048576
    or (v_result -> 'limits' ->> 'files')::int <> 32
    or (v_result -> 'limits' ->> 'columns')::int <> 64
    or has_function_privilege('authenticated', 'public.backup_diagnostic_definition(text,text,text,text,text)', 'EXECUTE')
    or not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = 'public.get_backup_diagnostics()'::regprocedure and p.prosecdef and p.provolatile = 's')
    or exists (select 1 from pg_catalog.pg_proc p
      where p.oid = 'public.backup_diagnostic_definition(text,text,text,text,text)'::regprocedure and p.prosecdef)
    or not has_function_privilege('authenticated', 'public.get_backup_diagnostics()', 'EXECUTE') then
    raise exception 'Diagnóstico read-only, limites ou privilégios inválidos.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  select count(*) into v_count from public.leads where owner_id = v_owner;
  if v_count <> 0 then raise exception 'RLS permitiu leitura de outro proprietário.'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  reset role;
  begin
    perform public.restore_backup_financial_rows();
    raise exception 'RPC financeira executou fora do contexto de restore.';
  exception when others then
    if sqlerrm <> 'Restore financeiro fora do contexto de restore.' then raise; end if;
  end;
  if has_table_privilege('authenticated', 'public.financial_payments', 'INSERT')
    or has_function_privilege('authenticated', 'public.restore_backup_financial_rows()', 'EXECUTE') then
    raise exception 'Escrita financeira direta ou RPC financeira exposta ao cliente.';
  end if;
  v_function := pg_catalog.pg_get_functiondef('public.lock_backup_restore()'::regprocedure);
  v_canonical_lock := pg_catalog.pg_get_functiondef('public.lock_project_task_mutations()'::regprocedure);
  v_positions := array[
    position(':payment:' in v_function), position(':clients' in v_function),
    position(':contract:' in v_function), position(':restore' in v_function),
    position(''':project_tasks''' in v_function), position('for update' in v_function),
    position('for v_lead in select id from pg_temp.backup_restore_leads order by id loop' in v_function),
    position('perform l.id from public.leads l where l.id = v_lead and l.owner_id = v_owner for update;' in v_function)
  ];
  if array_position(v_positions, 0) is not null
    or v_positions[1] >= v_positions[2] or v_positions[2] >= v_positions[3]
    or v_positions[3] >= v_positions[4] or v_positions[4] >= v_positions[5]
    or v_positions[5] >= v_positions[6] or v_positions[6] >= v_positions[7]
    or v_positions[7] >= v_positions[8] or position('insert into public.' in v_function) > 0
    or position(''':project_tasks''' in v_canonical_lock) = 0
    or position(':project_tasks:' in v_canonical_lock) > 0
    or position(':project_tasks:' in v_function) > 0
    or has_function_privilege('authenticated', 'public.lock_backup_restore()', 'EXECUTE') then
    raise exception 'Helper de locks canônico inválido ou exposto: %', v_positions;
  end if;
  v_function := pg_catalog.pg_get_functiondef('public.restore_backup(jsonb,text,text)'::regprocedure);
  if position('perform public.lock_backup_restore();' in v_function) = 0
    or position('perform public.lock_backup_restore();' in v_function) > position('insert into public.' in v_function)
    or position('insert into public.' in v_function) = 0 then
    raise exception 'Restore genérico escreveu antes dos locks canônicos.';
  end if;
  v_function := pg_catalog.pg_get_functiondef('public.restore_backup_financial_rows()'::regprocedure);
  if position('perform public.lock_backup_restore();' in v_function) > 0
    or position('public.restore_backup_financial_rows();' in pg_catalog.pg_get_functiondef(
      'public.restore_backup(jsonb,text,text)'::regprocedure)) = 0 then
    raise exception 'Restore financeiro não usa exclusivamente os locks do restore canônico.';
  end if;
end
$$;

create temp table pg_temp.diag_before (table_name text primary key, digest text);
create temp table pg_temp.diag_after (table_name text primary key, digest text);

create or replace function pg_temp.capture_diag_snapshot(p_target text)
returns void
language plpgsql
set search_path = pg_temp, public, pg_catalog
as $$
declare
  v_definition record;
begin
  for v_definition in select * from public.backup_table_registry loop
    execute format(
      'insert into pg_temp.%I (table_name, digest) '
      'select %L, md5(coalesce(string_agg(to_jsonb(t)::text, E''\n'' order by t.%I), '''')) '
      'from public.%I t',
      p_target, v_definition.table_name, v_definition.key_column, v_definition.table_name
    );
  end loop;
end;
$$;

create or replace function pg_temp.diag_insert(p_table text, p_row jsonb)
returns uuid
language plpgsql
set search_path = pg_temp, public, pg_catalog
as $$
declare
  v_columns text;
  v_types text;
  v_id uuid;
begin
  select string_agg(format('%I', a.attname), ',' order by a.attnum),
    string_agg(format('%I %s', a.attname, format_type(a.atttypid, a.atttypmod)), ',' order by a.attnum)
    into v_columns, v_types
  from jsonb_object_keys(p_row) as keys(column_name)
  join pg_catalog.pg_attribute a
    on a.attrelid = pg_catalog.to_regclass(format('public.%I', p_table))
    and a.attname = keys.column_name and a.attnum > 0 and not a.attisdropped and not a.attgenerated;
  if v_columns is null then raise exception 'Fixture sem colunas válidas: %', p_table; end if;
  execute format(
    'insert into public.%I (%s) select %s from jsonb_to_record($1) as x(%s) returning id',
    p_table, v_columns, v_columns, v_types
  ) into v_id using p_row;
  return v_id;
end;
$$;

do $$
declare
  v_relation record;
  v_constraint record;
  v_index record;
  v_column record;
begin
  for v_relation in
    select c.oid, c.relname, r.key_column
    from pg_catalog.pg_class c
    join public.backup_table_registry r on r.table_name = c.relname
    where c.relnamespace = 'public'::regnamespace
  loop
    for v_constraint in
      select conname from pg_catalog.pg_constraint
      where conrelid = v_relation.oid and contype in ('f','c','u')
    loop
      execute format('alter table public.%I drop constraint %I', v_relation.relname, v_constraint.conname);
    end loop;
    for v_index in
      select c.relname as index_name from pg_catalog.pg_index i
      join pg_catalog.pg_class c on c.oid = i.indexrelid
      where i.indrelid = v_relation.oid and i.indisunique and not i.indisprimary
    loop
      execute format('drop index public.%I', v_index.index_name);
    end loop;
    for v_column in
      select a.attname from pg_catalog.pg_attribute a
      where a.attrelid = v_relation.oid and a.attnum > 0 and not a.attisdropped
        and not a.attgenerated and a.attnotnull and a.attname <> v_relation.key_column
    loop
      execute format('alter table public.%I alter column %I drop not null',
        v_relation.relname, v_column.attname);
    end loop;
  end loop;
end;
$$;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_owner_lead uuid := gen_random_uuid();
  v_other_lead uuid := gen_random_uuid();
  v_client_a uuid := gen_random_uuid();
  v_client_b uuid := gen_random_uuid();
  v_link_a uuid := gen_random_uuid();
  v_contract_a uuid := gen_random_uuid();
  v_contract_b uuid := gen_random_uuid();
  v_contract_fin uuid := gen_random_uuid();
  v_project_a uuid := gen_random_uuid();
  v_project_b uuid := gen_random_uuid();
  v_project_fin_a uuid := gen_random_uuid();
  v_project_fin_b uuid := gen_random_uuid();
  v_installment_fin uuid := gen_random_uuid();
  v_installment_extra uuid := gen_random_uuid();
  v_receipt uuid := gen_random_uuid();
  v_receipt_over uuid := gen_random_uuid();
  v_refund uuid := gen_random_uuid();
  v_allocation uuid := gen_random_uuid();
  v_allocation_refund uuid := gen_random_uuid();
  v_invalid_activity uuid := gen_random_uuid();
  v_invalid_expense uuid := gen_random_uuid();
  v_check_null uuid := gen_random_uuid();
  v_missing_followup_date uuid := gen_random_uuid();
  v_missing_payment_date uuid := gen_random_uuid();
  v_missing_revision_date uuid := gen_random_uuid();
  v_invalid_expense_category uuid := gen_random_uuid();
  v_invalid_revenue_category uuid := gen_random_uuid();
  v_invalid_task_category uuid := gen_random_uuid();
  v_invalid_revision_description uuid := gen_random_uuid();
  v_invalid_expense_description uuid := gen_random_uuid();
  v_missing_task_title uuid := gen_random_uuid();
  v_definition record;
  v_mapping record;
  v_sample record;
  v_row jsonb;
  v_value uuid;
  v_duplicate_id uuid;
  v_result jsonb;
  v_other_result jsonb;
  v_expected text[] := array[
    'rls.disabled','duplicate.clients.contact','duplicate.leads.contact','duplicate.leads.cnpj',
    'duplicate.contract_installments.position','duplicate.financial_payment_allocations.pair',
    'duplicate.lead_digital_checks.pair','duplicate.expense_categories.name','duplicate.revenue_categories.name',
    'invalid.preferences','invalid.service_prices','invalid.whatsapp_template','invalid.next_contact_at',
    'invalid.maps_url','invalid.project_contract','invalid.source_link_client',
    'invalid.client_activity_chain','invalid.client_activity_type','invalid.expense_links',
    'invalid.allocation_contract','invalid.refund_chain','invalid.project_allocation','invalid.installment_sum',
    'invalid.contract_receipts','invalid.payment_allocation','invalid.refund_total','invalid.installment_net',
    'invalid.refund_allocation','invalid.values','invalid.lead_values','invalid.statuses','invalid.dates',
    'invalid.required_dates','invalid.text_lengths','invalid.event_timestamps','invalid.created_by'
  ];
  v_sample_assertions jsonb;
  v_global_samples jsonb := '[]'::jsonb;
  v_code text;
begin
  insert into auth.users (id, email) values
    (v_owner, 'etapa3-diag-owner-' || v_owner::text || '@example.test'),
    (v_other, 'etapa3-diag-other-' || v_other::text || '@example.test');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('session_replication_role', 'replica', true);

  for v_definition in select * from public.backup_table_registry loop
    if v_definition.table_name = 'user_settings' then
      insert into public.user_settings (owner_id, preferences, created_at, updated_at)
      values (v_owner, '[]'::jsonb, null, null);
    else
      v_row := jsonb_build_object('id', gen_random_uuid(), 'owner_id', v_owner, 'created_at', null);
      if 'updated_at' = any(v_definition.columns) then
        v_row := v_row || jsonb_build_object('updated_at', null);
      end if;
      perform pg_temp.diag_insert(v_definition.table_name, v_row);
    end if;
  end loop;
  update public.user_settings
    set preferences = '[]'::jsonb, service_prices = '[]'::jsonb,
      whatsapp_template = repeat('x', 4001)
    where owner_id = v_owner;

  perform pg_temp.diag_insert('leads', jsonb_build_object(
    'id', v_owner_lead, 'owner_id', v_owner, 'name', 'Lead inválido A', 'phone', '(11) 99999-0001',
    'whatsapp', '11999990001', 'cnpj', '11.111.111/0001-81', 'maps_url', 'javascript:alert(1)',
    'status', 'status_inexistente', 'priority', 'prioridade_inexistente', 'estimated_value', -1,
    'score', 101, 'created_at', null, 'updated_at', null));
  perform pg_temp.diag_insert('leads', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'name', 'Lead inválido B', 'phone', '11999990001',
    'whatsapp', '(11) 98888-0001', 'cnpj', '11111111000181'));
  perform pg_temp.diag_insert('leads', jsonb_build_object(
    'id', v_other_lead, 'owner_id', v_other, 'name', 'Lead do outro proprietário'));

  perform pg_temp.diag_insert('clients', jsonb_build_object(
    'id', v_client_a, 'owner_id', v_owner, 'name', 'Cliente A', 'phone', '(11) 98888-0001',
    'whatsapp', '11988880001', 'cnpj', '22.222.222/0001-22', 'status', 'status_inexistente'));
  perform pg_temp.diag_insert('clients', jsonb_build_object(
    'id', v_client_b, 'owner_id', v_owner, 'name', 'Cliente B', 'phone', '11988880001',
    'whatsapp', '(11) 98888-0001', 'cnpj', '22222222000122'));
  perform pg_temp.diag_insert('lead_client_links', jsonb_build_object(
    'id', v_link_a, 'owner_id', v_owner, 'lead_id', v_owner_lead, 'client_id', v_client_a));

  perform pg_temp.diag_insert('contracts', jsonb_build_object(
    'id', v_contract_a, 'owner_id', v_owner, 'client_id', v_client_a, 'total_value', 10,
    'contracted_at', '2020-01-02', 'due_date', '2020-01-01', 'status', 'active'));
  perform pg_temp.diag_insert('contracts', jsonb_build_object(
    'id', v_contract_b, 'owner_id', v_owner, 'client_id', v_client_b, 'source_link_id', v_link_a,
    'total_value', 10, 'contracted_at', '2020-01-01', 'status', 'active'));
  perform pg_temp.diag_insert('contracts', jsonb_build_object(
    'id', v_contract_fin, 'owner_id', v_owner, 'client_id', v_client_a, 'total_value', 100,
    'contracted_at', '2020-01-01', 'status', 'active'));

  perform pg_temp.diag_insert('projects', jsonb_build_object(
    'id', v_project_a, 'owner_id', v_owner, 'client_id', v_client_a, 'contract_id', v_contract_b,
    'contracted_value', 1, 'status', 'active'));
  perform pg_temp.diag_insert('projects', jsonb_build_object(
    'id', v_project_b, 'owner_id', v_owner, 'client_id', v_client_b, 'source_link_id', v_link_a,
    'contracted_value', 1, 'status', 'not_started'));
  perform pg_temp.diag_insert('projects', jsonb_build_object(
    'id', v_project_fin_a, 'owner_id', v_owner, 'client_id', v_client_a, 'contract_id', v_contract_fin,
    'contracted_value', 60, 'status', 'in_development'));
  perform pg_temp.diag_insert('projects', jsonb_build_object(
    'id', v_project_fin_b, 'owner_id', v_owner, 'client_id', v_client_a, 'contract_id', v_contract_fin,
    'contracted_value', 60, 'status', 'in_development'));

  perform pg_temp.diag_insert('client_activities', jsonb_build_object(
    'id', v_invalid_activity, 'owner_id', v_owner, 'client_id', v_client_a, 'project_id', v_project_b,
    'contract_id', v_contract_b, 'type', 'observacao', 'description', 'Cadeia incompatível',
    'created_by', v_other));
  perform pg_temp.diag_insert('lead_activities', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'type', 'tipo_inexistente', 'description', 'Autor inválido',
    'user_id', v_other));
  perform pg_temp.diag_insert('lead_followups', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'lead_id', v_owner_lead, 'due_at', '2020-03-01T12:00:00Z',
    'status', 'pendente', 'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('lead_followups', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'status', 'concluido', 'completed_at', null));
  perform pg_temp.diag_insert('lead_followups', jsonb_build_object(
    'id', v_missing_followup_date, 'owner_id', v_owner, 'status', 'pendente',
    'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('lead_digital_checks', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'item', 'item_inexistente', 'verified', true,
    'verified_at', null));
  perform pg_temp.diag_insert('lead_digital_checks', jsonb_build_object(
    'id', v_check_null, 'owner_id', v_owner, 'lead_id', v_owner_lead, 'item', 'website',
    'verified', null, 'created_at', now()));
  perform pg_temp.diag_insert('lead_digital_checks', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'lead_id', v_owner_lead, 'item', 'instagram',
    'verified', false, 'verified_at', null));
  perform pg_temp.diag_insert('lead_digital_checks', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'lead_id', v_owner_lead, 'item', 'instagram',
    'verified', false, 'verified_at', null));
  perform pg_temp.diag_insert('project_tasks', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'status', 'completed', 'completed_at', null,
    'start_date', '2020-02-02', 'due_date', '2020-02-01'));
  perform pg_temp.diag_insert('project_tasks', jsonb_build_object(
    'id', v_invalid_task_category, 'owner_id', v_owner, 'title', 'Categoria longa',
    'category', repeat('x', 41), 'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('project_tasks', jsonb_build_object(
    'id', v_missing_task_title, 'owner_id', v_owner, 'title', null,
    'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('project_revisions', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'status', 'approved', 'completed_at', null,
    'approved_at', null));
  perform pg_temp.diag_insert('project_revisions', jsonb_build_object(
    'id', v_missing_revision_date, 'owner_id', v_owner, 'status', 'requested',
    'requested_at', null, 'description', 'Data ausente', 'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('project_revisions', jsonb_build_object(
    'id', v_invalid_revision_description, 'owner_id', v_owner, 'status', 'requested',
    'requested_at', now(), 'description', '   ', 'created_at', now(), 'updated_at', now()));

  perform pg_temp.diag_insert('contract_installments', jsonb_build_object(
    'id', v_installment_fin, 'owner_id', v_owner, 'contract_id', v_contract_fin,
    'position', 1, 'amount', 100, 'due_date', '2020-02-01'));
  perform pg_temp.diag_insert('contract_installments', jsonb_build_object(
    'id', v_installment_extra, 'owner_id', v_owner, 'contract_id', v_contract_fin,
    'position', 2, 'amount', 1, 'due_date', '2020-02-01'));
  perform pg_temp.diag_insert('contract_installments', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'contract_id', v_contract_fin,
    'position', 1, 'amount', 1, 'due_date', null));

  perform pg_temp.diag_insert('financial_payments', jsonb_build_object(
    'id', v_receipt, 'owner_id', v_owner, 'contract_id', v_contract_fin, 'type', 'receipt',
    'amount', 100, 'received_at', '2020-02-01T12:00:00Z', 'created_by', v_other));
  perform pg_temp.diag_insert('financial_payments', jsonb_build_object(
    'id', v_receipt_over, 'owner_id', v_owner, 'contract_id', v_contract_fin, 'type', 'receipt',
    'amount', 200, 'received_at', '2020-02-01T12:00:00Z'));
  perform pg_temp.diag_insert('financial_payments', jsonb_build_object(
    'id', v_missing_payment_date, 'owner_id', v_owner, 'type', 'receipt', 'amount', 1,
    'received_at', null, 'created_at', now()));
  perform pg_temp.diag_insert('financial_payments', jsonb_build_object(
    'id', v_refund, 'owner_id', v_owner, 'contract_id', v_contract_b, 'type', 'refund',
    'related_payment_id', v_receipt, 'amount', 150, 'received_at', '2020-02-02T12:00:00Z'));
  perform pg_temp.diag_insert('financial_payment_allocations', jsonb_build_object(
    'id', v_allocation, 'owner_id', v_owner, 'contract_id', v_contract_fin,
    'payment_id', v_receipt, 'installment_id', v_installment_fin, 'amount', 100));
  perform pg_temp.diag_insert('financial_payment_allocations', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'contract_id', v_contract_fin,
    'payment_id', v_receipt, 'installment_id', v_installment_fin, 'amount', 1));
  perform pg_temp.diag_insert('financial_payment_allocations', jsonb_build_object(
    'id', v_allocation_refund, 'owner_id', v_owner, 'contract_id', v_contract_fin,
    'payment_id', v_refund, 'installment_id', v_installment_fin, 'amount', 120));
  perform pg_temp.diag_insert('financial_payment_allocations', jsonb_build_object(
    'id', gen_random_uuid(), 'owner_id', v_owner, 'contract_id', gen_random_uuid(),
    'payment_id', v_receipt, 'installment_id', v_installment_fin, 'amount', 1));
  perform pg_temp.diag_insert('financial_expenses', jsonb_build_object(
    'id', v_invalid_expense, 'owner_id', v_owner, 'description', 'Despesa incompatível',
    'project_id', v_project_b, 'contract_id', v_contract_a, 'amount', -1,
    'expense_date', null, 'status', 'paid', 'paid_at', null));
  perform pg_temp.diag_insert('financial_expenses', jsonb_build_object(
    'id', v_invalid_expense_description, 'owner_id', v_owner, 'description', '   ', 'amount', 0,
    'expense_date', '2020-01-01', 'status', 'pending', 'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('expense_categories', jsonb_build_object(
    'id', v_invalid_expense_category, 'owner_id', v_owner, 'name', repeat('x', 61),
    'created_at', now(), 'updated_at', now()));
  perform pg_temp.diag_insert('revenue_categories', jsonb_build_object(
    'id', v_invalid_revenue_category, 'owner_id', v_owner, 'name', null,
    'created_at', now(), 'updated_at', now()));

  for v_mapping in select * from (values
    ('lead_activities','lead_id','leads'), ('lead_followups','lead_id','leads'),
    ('lead_digital_checks','lead_id','leads'), ('lead_client_links','lead_id','leads'),
    ('lead_client_links','client_id','clients'), ('contracts','client_id','clients'),
    ('contracts','source_link_id','lead_client_links'), ('projects','client_id','clients'),
    ('projects','contract_id','contracts'), ('projects','source_link_id','lead_client_links'),
    ('client_activities','client_id','clients'), ('client_activities','project_id','projects'),
    ('client_activities','contract_id','contracts'), ('project_tasks','project_id','projects'),
    ('project_revisions','project_id','projects'), ('contract_installments','contract_id','contracts'),
    ('financial_payments','contract_id','contracts'), ('financial_payments','related_payment_id','financial_payments'),
    ('financial_payments','revenue_category_id','revenue_categories'),
    ('financial_payment_allocations','contract_id','contracts'),
    ('financial_payment_allocations','payment_id','financial_payments'),
    ('financial_payment_allocations','installment_id','contract_installments'),
    ('financial_expenses','category_id','expense_categories'), ('financial_expenses','project_id','projects'),
    ('financial_expenses','contract_id','contracts')
  ) as mapping(child_table, child_column, parent_table) loop
    v_expected := v_expected || array['orphan.' || v_mapping.child_table || '.' || v_mapping.child_column];
    perform pg_temp.diag_insert(v_mapping.child_table, jsonb_build_object(
      'id', gen_random_uuid(), 'owner_id', v_owner, v_mapping.child_column, gen_random_uuid()));
  end loop;

  for v_mapping in select * from (values
    ('clients','creation_key'), ('contracts','creation_key'), ('contracts','source_link_id'),
    ('projects','source_link_id'), ('financial_payments','idempotency_key'), ('lead_client_links','lead_id')
  ) as mapping(table_name, column_name) loop
    v_value := gen_random_uuid();
    v_expected := v_expected || array['duplicate.' || v_mapping.table_name || '.' || v_mapping.column_name];
    v_duplicate_id := pg_temp.diag_insert(v_mapping.table_name, jsonb_build_object(
      'id', gen_random_uuid(), 'owner_id', v_owner, v_mapping.column_name, v_value));
    perform pg_temp.diag_insert(v_mapping.table_name, jsonb_build_object(
      'id', gen_random_uuid(), 'owner_id', v_other, v_mapping.column_name, v_value));
    v_global_samples := v_global_samples || jsonb_build_array(jsonb_build_object(
      'code', 'duplicate.' || v_mapping.table_name || '.' || v_mapping.column_name,
      'id', v_duplicate_id::text));
  end loop;

  for v_mapping in select * from (values
    ('expense_categories','name'), ('revenue_categories','name')
  ) as mapping(table_name, column_name) loop
    perform pg_temp.diag_insert(v_mapping.table_name, jsonb_build_object(
      'id', gen_random_uuid(), 'owner_id', v_owner, 'name', 'Categoria duplicada'));
    perform pg_temp.diag_insert(v_mapping.table_name, jsonb_build_object(
      'id', gen_random_uuid(), 'owner_id', v_owner, 'name', 'categoria DUPLICADA'));
  end loop;

  for v_mapping in select * from public.backup_table_registry loop
    v_expected := v_expected || array['orphan.owner.' || v_mapping.table_name];
    if 'created_at' = any(v_mapping.columns) then
      v_expected := v_expected || array['invalid.timestamps.' || v_mapping.table_name];
    end if;
    v_expected := v_expected || array['invalid.required_fields.' || v_mapping.table_name];
  end loop;
  v_expected := v_expected || array[
    'duplicate.clients.phone_canonical','duplicate.clients.whatsapp_canonical','duplicate.clients.cnpj_digits'
  ];
  update public.lead_client_links set owner_id = v_other where id = v_link_a;

  perform set_config('session_replication_role', 'origin', true);
  alter table public.leads disable row level security;
  delete from public.profiles where id = v_owner;
  delete from auth.users where id = v_owner;
  perform pg_temp.capture_diag_snapshot('diag_before');
  v_sample_assertions := jsonb_build_array(
    jsonb_build_object('code','rls.disabled','id','leads'),
    jsonb_build_object('code','orphan.owner.leads','id',v_owner_lead::text),
    jsonb_build_object('code','duplicate.leads.contact','id',v_owner_lead::text),
    jsonb_build_object('code','duplicate.leads.cnpj','id',v_owner_lead::text),
    jsonb_build_object('code','duplicate.clients.contact','id',v_client_a::text),
    jsonb_build_object('code','duplicate.clients.phone_canonical','id',v_client_a::text),
    jsonb_build_object('code','duplicate.clients.whatsapp_canonical','id',v_client_a::text),
    jsonb_build_object('code','duplicate.clients.cnpj_digits','id',v_client_a::text),
    jsonb_build_object('code','duplicate.contract_installments.position','id',v_installment_fin::text),
    jsonb_build_object('code','duplicate.financial_payment_allocations.pair','id',v_allocation::text),
    jsonb_build_object('code','invalid.preferences','id',v_owner::text),
    jsonb_build_object('code','invalid.service_prices','id',v_owner::text),
    jsonb_build_object('code','invalid.whatsapp_template','id',v_owner::text),
    jsonb_build_object('code','invalid.next_contact_at','id',v_owner_lead::text),
    jsonb_build_object('code','invalid.maps_url','id',v_owner_lead::text),
    jsonb_build_object('code','invalid.project_contract','id',v_project_a::text),
    jsonb_build_object('code','invalid.source_link_client','id',v_contract_b::text),
    jsonb_build_object('code','invalid.client_activity_chain','id',v_invalid_activity::text),
    jsonb_build_object('code','invalid.client_activity_type','id',v_invalid_activity::text),
    jsonb_build_object('code','invalid.expense_links','id',v_invalid_expense::text),
    jsonb_build_object('code','invalid.allocation_contract','id',v_allocation_refund::text),
    jsonb_build_object('code','invalid.refund_chain','id',v_refund::text),
    jsonb_build_object('code','invalid.project_allocation','id',v_contract_fin::text),
    jsonb_build_object('code','invalid.installment_sum','id',v_contract_fin::text),
    jsonb_build_object('code','invalid.contract_receipts','id',v_contract_fin::text),
    jsonb_build_object('code','invalid.payment_allocation','id',v_receipt_over::text),
    jsonb_build_object('code','invalid.refund_total','id',v_refund::text),
    jsonb_build_object('code','invalid.installment_net','id',v_installment_fin::text),
    jsonb_build_object('code','invalid.refund_allocation','id',v_allocation_refund::text),
    jsonb_build_object('code','invalid.lead_values','id',v_owner_lead::text),
    jsonb_build_object('code','invalid.dates','id',v_contract_a::text),
    jsonb_build_object('code','invalid.required_dates','id',v_missing_followup_date::text),
    jsonb_build_object('code','invalid.required_dates','id',v_missing_payment_date::text),
    jsonb_build_object('code','invalid.required_dates','id',v_missing_revision_date::text),
    jsonb_build_object('code','invalid.text_lengths','id',v_invalid_expense_category::text),
    jsonb_build_object('code','invalid.text_lengths','id',v_invalid_revenue_category::text),
    jsonb_build_object('code','invalid.text_lengths','id',v_invalid_task_category::text),
    jsonb_build_object('code','invalid.text_lengths','id',v_invalid_revision_description::text),
    jsonb_build_object('code','invalid.text_lengths','id',v_invalid_expense_description::text),
    jsonb_build_object('code','invalid.event_timestamps','id',v_check_null::text),
    jsonb_build_object('code','invalid.created_by','id',v_invalid_activity::text),
    jsonb_build_object('code','invalid.required_fields.lead_followups','id',v_missing_followup_date::text),
    jsonb_build_object('code','invalid.required_fields.financial_payments','id',v_missing_payment_date::text),
    jsonb_build_object('code','invalid.required_fields.project_revisions','id',v_missing_revision_date::text),
    jsonb_build_object('code','invalid.required_fields.lead_digital_checks','id',v_check_null::text),
    jsonb_build_object('code','invalid.required_fields.project_tasks','id',v_missing_task_title::text),
    jsonb_build_object('code','invalid.required_fields.user_settings','id',v_owner::text)
  ) || v_global_samples;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_result := public.get_backup_diagnostics();
  for v_code in select unnest(v_expected) loop
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements(v_result -> 'checks') check_row(value)
      where value ->> 'code' = v_code and (value ->> 'count')::bigint > 0
    ) then
      raise exception 'Diagnóstico não detectou a categoria sintética: %', v_code;
    end if;
  end loop;
  for v_sample in select value from pg_catalog.jsonb_array_elements(v_sample_assertions) as item(value) loop
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements(v_result -> 'checks') check_row(value)
      where value ->> 'code' = v_sample ->> 'code'
        and value -> 'sample_ids' @> jsonb_build_array(v_sample -> 'id')
    ) then
      raise exception 'Diagnóstico não incluiu o ID sintético esperado: % / %',
        v_sample ->> 'code', v_sample ->> 'id';
    end if;
  end loop;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_result -> 'checks') check_row(value)
    where pg_catalog.jsonb_array_length(value -> 'sample_ids') > 20
      or (value ->> 'count')::bigint < 0
  ) then
    raise exception 'Diagnóstico violou limite de amostras ou contagem.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  v_other_result := public.get_backup_diagnostics();
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_other_result -> 'checks') check_row(value)
    where value ->> 'code' = 'orphan.owner.leads' and (value ->> 'count')::bigint <> 0
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(v_other_result -> 'checks') check_row(value),
      pg_catalog.jsonb_array_elements_text(value -> 'sample_ids') sample(id)
    where sample.id = v_owner_lead::text
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_other_result -> 'checks') check_row(value),
      pg_catalog.jsonb_array_elements(v_global_samples) global_sample(entry)
    where check_row.value ->> 'code' = global_sample.entry ->> 'code'
      and check_row.value -> 'sample_ids' @> jsonb_build_array(global_sample.entry -> 'id')
  ) then
    raise exception 'Diagnóstico vazou dados ou órfãos de outro proprietário.';
  end if;

  reset role;
  perform pg_temp.capture_diag_snapshot('diag_after');
  if exists (
    select 1 from pg_temp.diag_before b
    full join pg_temp.diag_after a using (table_name)
    where b.digest is distinct from a.digest
  ) or (select count(*) from pg_temp.diag_before) <> 18
    or (select count(*) from pg_temp.diag_after) <> 18 then
    raise exception 'Diagnóstico alterou dados ou deixou de cobrir as 18 tabelas.';
  end if;
end
$$;

rollback;
```

Comando RED:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_backup.sql
```

Esperado: falha porque `0012` e o registry não existem. Sem banco/configuração autorizada, classificar como dependente de configuração externa.

- [ ] **Step 2: Criar registry e validação de pacote**

```sql
-- supabase/migrations/0012_etapa3_backup.sql
begin;

create table public.backup_table_registry (
  table_name text primary key,
  file_name text not null unique,
  key_column text not null check (key_column in ('id','owner_id')),
  columns text[] not null,
  insert_order integer not null unique
);

alter table public.backup_table_registry enable row level security;
revoke all on public.backup_table_registry from public, anon, authenticated;
grant select on public.backup_table_registry to authenticated;
create policy backup_table_registry_select on public.backup_table_registry for select using (true);

insert into public.backup_table_registry (table_name, file_name, key_column, columns, insert_order) values
('leads','leads.csv','id',array[
  'id','owner_id','name','responsible_name','niche','phone','whatsapp','email','cnpj','instagram','facebook','website','menu_url','catalog_url','maps_url',
  'country','state','city','district','address','zip_code','has_website','has_instagram','has_facebook','has_digital_menu','has_digital_catalog','has_landing_page','has_business_whatsapp',
  'status','offered_service','notes','source','next_contact_at','last_verified_at','estimated_value','negotiated_value','contracted_value','received_value','score','priority','needs','score_reasons','created_at','updated_at'
],1),
('lead_activities','lead_activities.csv','id',array['id','lead_id','owner_id','type','description','user_id','created_at'],2),
('lead_followups','lead_followups.csv','id',array['id','lead_id','owner_id','due_at','reason','note','status','completed_at','result','created_at','updated_at'],3),
('lead_digital_checks','checks.csv','id',array['id','lead_id','owner_id','item','verified','verified_at','created_at'],4),
('clients','clients.csv','id',array[
  'id','owner_id','creation_key','name','responsible_name','phone','whatsapp','email','cnpj','website','instagram','address','city','district','zip_code','state','niche','status','source','converted_at','notes','archived_at','created_at','updated_at'
],5),
('lead_client_links','lead_client_links.csv','id',array['id','owner_id','lead_id','client_id','converted_at','created_at'],6),
('contracts','contracts.csv','id',array['id','owner_id','client_id','source_link_id','creation_key','service','total_value','contracted_at','due_date','payment_method','payment_terms','status','notes','cancelled_at','created_at','updated_at'],7),
('projects','projects.csv','id',array['id','owner_id','client_id','contract_id','source_link_id','name','service','contracted_value','description','start_date','due_date','responsible_name','priority','status','completed_at','delivered_at','delivery_confirmed_at','delivery_url','files_url','final_notes','archived_at','created_at','updated_at'],8),
('client_activities','client_activities.csv','id',array['id','owner_id','client_id','project_id','contract_id','type','description','metadata','created_by','created_at'],9),
('project_tasks','project_tasks.csv','id',array['id','owner_id','project_id','title','description','status','responsible_name','start_date','due_date','priority','position','notes','completed_at','cancelled_at','category','created_at','updated_at'],10),
('project_revisions','project_revisions.csv','id',array['id','owner_id','project_id','requested_at','description','responsible_name','status','completed_at','approved_at','notes','created_at','updated_at'],11),
('contract_installments','contract_installments.csv','id',array['id','owner_id','contract_id','position','amount','due_date','notes','created_at','updated_at'],12),
('expense_categories','expense_categories.csv','id',array['id','owner_id','name','archived_at','created_at','updated_at'],13),
('revenue_categories','revenue_categories.csv','id',array['id','owner_id','name','archived_at','created_at','updated_at'],14),
('financial_payments','financial_payments.csv','id',array['id','owner_id','contract_id','idempotency_key','related_payment_id','type','amount','received_at','payment_method','notes','revenue_category_id','created_by','created_at'],15),
('financial_payment_allocations','allocations.csv','id',array['id','owner_id','contract_id','payment_id','installment_id','amount','created_at'],16),
('financial_expenses','expenses.csv','id',array['id','owner_id','description','category_id','amount','expense_date','due_date','paid_at','payment_method','status','project_id','contract_id','notes','cancelled_at','created_at','updated_at'],17),
('user_settings','preferences.csv','owner_id',array['owner_id','service_prices','whatsapp_template','preferences','created_at','updated_at'],18);

-- O diagnóstico precisa continuar conhecendo o schema canônico mesmo quando a
-- fixture remove constraints para inserir corrupção sintética.
alter table public.backup_table_registry
  add column required_columns text[] not null default '{}'::text[];

update public.backup_table_registry r
set required_columns = coalesce((
  select array_agg(a.attname::text order by a.attnum)
  from pg_catalog.pg_attribute a
  where a.attrelid = pg_catalog.to_regclass(format('public.%I', r.table_name))
    and a.attnum > 0
    and not a.attisdropped
    and not a.attgenerated
    and a.attnotnull
), '{}'::text[]);

alter table public.backup_table_registry
  alter column required_columns drop default;
alter table public.backup_table_registry
  add constraint backup_table_registry_required_columns_check
  check (cardinality(required_columns) > 0 and required_columns <@ columns and key_column = any(required_columns));

revoke insert, update, delete on public.backup_table_registry from authenticated;

create or replace function public.backup_json_canonical(p_value jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case pg_catalog.jsonb_typeof(p_value)
    when 'null' then 'null'
    when 'boolean' then p_value::text
    when 'string' then pg_catalog.to_jsonb(p_value #>> '{}')::text
    when 'number' then pg_catalog.trim_scale(p_value)::text
    when 'array' then '[' || coalesce((
      select pg_catalog.string_agg(public.backup_json_canonical(value), ',' order by ordinality)
      from pg_catalog.jsonb_array_elements(p_value) with ordinality
    ), '') || ']'
    when 'object' then '{' || coalesce((
      select pg_catalog.string_agg(pg_catalog.to_jsonb(key)::text || ':' || public.backup_json_canonical(value), ',' order by key collate "C")
      from pg_catalog.jsonb_each(p_value)
    ), '') || '}'
  end;
$$;

create or replace function public.backup_header(p_column text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_column
    when 'id' then 'ID' when 'owner_id' then 'Proprietário' when 'lead_id' then 'Lead'
    when 'client_id' then 'Cliente' when 'project_id' then 'Projeto' when 'contract_id' then 'Contrato'
    when 'user_id' then 'Usuário' when 'created_by' then 'Criado por' when 'created_at' then 'Criado em'
    when 'updated_at' then 'Atualizado em' when 'name' then 'Nome' when 'responsible_name' then 'Responsável'
    when 'status' then 'Status' when 'notes' then 'Notas' when 'description' then 'Descrição'
    when 'type' then 'Tipo' when 'amount' then 'Valor' when 'total_value' then 'Valor total'
    when 'position' then 'Posição' when 'priority' then 'Prioridade' when 'category' then 'Categoria'
    when 'source' then 'Origem' when 'due_date' then 'Vencimento' when 'start_date' then 'Início'
    when 'phone' then 'Telefone' when 'whatsapp' then 'WhatsApp' when 'email' then 'E-mail'
    when 'cnpj' then 'CNPJ' when 'niche' then 'Nicho' when 'city' then 'Cidade' when 'state' then 'Estado'
    when 'district' then 'Bairro' when 'address' then 'Endereço' when 'zip_code' then 'CEP'
    when 'service' then 'Serviço' when 'payment_method' then 'Forma de pagamento'
    when 'preferences' then 'Preferências' when 'service_prices' then 'Preços de serviço'
    when 'whatsapp_template' then 'Template do WhatsApp'
    else pg_catalog.upper(pg_catalog.left(p_column, 1)) || pg_catalog.substr(pg_catalog.replace(p_column, '_', ' '), 2)
  end;
$$;

create or replace function public.backup_csv_cell(p_value jsonb, p_json boolean)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_text text;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then return '\N'; end if;
  if p_json then
    v_text := public.backup_json_canonical(p_value);
  elsif pg_catalog.jsonb_typeof(p_value) = 'string' then
    v_text := p_value #>> '{}';
  elsif pg_catalog.jsonb_typeof(p_value) = 'boolean' then
    v_text := p_value::text;
  elsif pg_catalog.jsonb_typeof(p_value) = 'number' then
    v_text := pg_catalog.trim_scale(p_value)::text;
  else
    raise exception 'Coluna textual recebeu JSON estruturado.' using errcode = '22023';
  end if;
  if pg_catalog.octet_length(v_text) > 1048576 then
    raise exception 'Campo textual excede 1 MiB.' using errcode = '22023';
  end if;
  if v_text = '\N' then return '\\N'; end if;
  if pg_catalog.left(pg_catalog.regexp_replace(v_text, '^([[:space:]]|[[:cntrl:]])*', ''), 1)
    in ('=', '+', '-', '@', '''') then return ''' || v_text; end if;
  return v_text;
end;
$$;

create or replace function public.backup_csv_for_table(p_table text, p_rows jsonb)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_def public.backup_table_registry%rowtype;
  v_row jsonb;
  v_cells text[] := '{}'::text[];
  v_text text;
  v_index int;
begin
  select * into v_def from public.backup_table_registry where table_name = p_table;
  if not found or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Tabela de backup inválida.' using errcode = '22023';
  end if;
  v_text := U&'\FEFF' || '"' || pg_catalog.replace((
    select pg_catalog.string_agg(public.backup_header(column_name), '";"' order by ordinality)
    from pg_catalog.unnest(v_def.columns) with ordinality as columns(column_name, ordinality)
  ), '"', '""') || '"' || E'\n';
  for v_row in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    v_cells := '{}'::text[];
    for v_index in 1..pg_catalog.array_length(v_def.columns, 1) loop
      v_cells[v_index] := '"' || pg_catalog.replace(public.backup_csv_cell(
        v_row -> v_def.columns[v_index],
        v_def.columns[v_index] = any(array['needs','score_reasons','metadata','service_prices','preferences'])
      ), '"', '""') || '"';
    end loop;
    v_text := v_text || pg_catalog.array_to_string(v_cells, ';') || E'\n';
  end loop;
  return v_text;
end;
$$;

revoke all on function public.backup_json_canonical(jsonb) from public, anon, authenticated;
revoke all on function public.backup_header(text) from public, anon, authenticated;
revoke all on function public.backup_csv_cell(jsonb,boolean) from public, anon, authenticated;
revoke all on function public.backup_csv_for_table(text,jsonb) from public, anon, authenticated;

create or replace function public.backup_package_hash(p_package jsonb)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(sha256(convert_to(p_package::text, 'UTF8')), 'hex');
$$;

revoke all on function public.backup_package_hash(jsonb) from public, anon, authenticated;

create or replace function public.validate_backup_package(p_package jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_manifest jsonb;
  v_tables jsonb;
  v_csv jsonb;
  v_csv_text text;
  v_expected text;
  v_file jsonb;
  v_rows jsonb;
  v_row jsonb;
  v_def record;
  v_total int := 0;
  v_file_count int;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_package is null or jsonb_typeof(p_package) <> 'object'
    or not public.jsonb_object_has_exact_keys(p_package, array['manifest','tables','csvText']) then
    raise exception 'Pacote de backup inválido.' using errcode = '22023';
  end if;
  if octet_length(p_package::text) > 4194304 then
    raise exception 'Pacote excede 4 MiB.' using errcode = '22023';
  end if;
  v_manifest := p_package -> 'manifest';
  v_tables := p_package -> 'tables';
  v_csv := p_package -> 'csvText';
  if v_manifest is null or pg_catalog.jsonb_typeof(v_manifest) <> 'object'
    or not public.jsonb_object_has_exact_keys(v_manifest, array['format','version','createdAt','ownerId','files','totalRows']) then
    raise exception 'Manifesto inválido ou de outro proprietário.' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(v_manifest -> 'format') <> 'string'
    or v_manifest ->> 'format' <> 'ber-crm-backup'
    or pg_catalog.jsonb_typeof(v_manifest -> 'version') <> 'number'
    or (v_manifest -> 'version')::text <> '1'
    or pg_catalog.jsonb_typeof(v_manifest -> 'ownerId') <> 'string'
    or v_manifest ->> 'ownerId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or (v_manifest ->> 'ownerId')::uuid <> v_owner
    or pg_catalog.jsonb_typeof(v_manifest -> 'createdAt') <> 'string'
    or (v_manifest ->> 'createdAt')::timestamptz is null
    or pg_catalog.jsonb_typeof(v_manifest -> 'files') <> 'array' then
    raise exception 'Manifesto inválido ou de outro proprietário.' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(v_manifest -> 'totalRows') <> 'number'
    or pg_catalog.length(v_manifest ->> 'totalRows') > 5
    or (v_manifest ->> 'totalRows') !~ '^[0-9]+$' then
    raise exception 'Manifesto inválido ou de outro proprietário.' using errcode = '42501';
  end if;
  if (v_manifest ->> 'totalRows')::int > 50000 then
    raise exception 'Pacote excede 50.000 linhas.' using errcode = '22023';
  end if;
  select count(*) into v_file_count from public.backup_table_registry;
  if v_file_count > 32 or jsonb_array_length(v_manifest -> 'files') <> v_file_count then
    raise exception 'Manifesto não contém os arquivos allowlisted ou excede 32 arquivos.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_tables) <> 'object'
    or (select count(*) from jsonb_object_keys(v_tables)) <> v_file_count
    or jsonb_typeof(v_csv) <> 'object'
    or (select count(*) from jsonb_object_keys(v_csv)) <> v_file_count
    or exists (
      select 1 from public.backup_table_registry r
      where not (v_tables ? r.table_name) or not (v_csv ? r.file_name)
    ) then raise exception 'Tabelas ou CSVs do pacote não correspondem ao registry.' using errcode = '22023';
  end if;

  for v_def in select * from public.backup_table_registry order by insert_order loop
    v_file := v_manifest -> 'files' -> (v_def.insert_order - 1);
    if v_file is null or pg_catalog.jsonb_typeof(v_file) <> 'object'
      or not public.jsonb_object_has_exact_keys(v_file, array['name','rows','sha256','columns']) then
      raise exception 'Arquivo, ordem ou colunas inválidos no manifesto: ' || v_def.file_name using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(v_file -> 'name') <> 'string'
      or v_file ->> 'name' <> v_def.file_name
      or pg_catalog.jsonb_typeof(v_file -> 'rows') <> 'number'
      or pg_catalog.length(v_file ->> 'rows') > 5
      or (v_file ->> 'rows') !~ '^[0-9]+$'
      or (v_file ->> 'rows')::int > 50000
      or pg_catalog.jsonb_typeof(v_file -> 'sha256') <> 'string'
      or v_file ->> 'sha256' !~ '^[0-9a-f]{64}$'
      or v_file ->> 'sha256' = repeat('0', 64)
      or pg_catalog.jsonb_typeof(v_file -> 'columns') <> 'array'
      or pg_catalog.jsonb_array_length(v_file -> 'columns') > 64
      or exists (select 1 from pg_catalog.jsonb_array_elements(v_file -> 'columns') as column(value)
        where pg_catalog.jsonb_typeof(value) <> 'string')
      or (select coalesce(array_agg(value #>> '{}' order by ordinality), array[]::text[])
        from pg_catalog.jsonb_array_elements(v_file -> 'columns') with ordinality as column(value, ordinality))
        is distinct from v_def.columns then
      raise exception 'Arquivo, ordem ou colunas inválidos no manifesto: ' || v_def.file_name using errcode = '22023';
    end if;
    v_rows := v_tables -> v_def.table_name;
    if jsonb_typeof(v_rows) <> 'array'
      or jsonb_array_length(v_rows) <> (v_file ->> 'rows')::int
      or jsonb_array_length(v_rows) > 50000 then
      raise exception 'Contagem de linhas inválida: ' || v_def.table_name using errcode = '22023';
    end if;
    if jsonb_typeof(v_csv -> v_def.file_name) <> 'string' then
      raise exception 'CSV ausente ou inválido: ' || v_def.file_name using errcode = '22023';
    end if;
    v_csv_text := v_csv ->> v_def.file_name;
    v_expected := public.backup_csv_for_table(v_def.table_name, v_rows);
    if v_csv_text <> v_expected then
      raise exception 'Ordem ou conteúdo canônico divergente em ' || v_def.file_name using errcode = '22023';
    end if;
    if encode(sha256(convert_to(v_csv_text, 'UTF8')), 'hex') <> v_file ->> 'sha256' then
      raise exception 'Hash do arquivo divergente: ' || v_def.file_name using errcode = '22023';
    end if;
    v_total := v_total + jsonb_array_length(v_rows);
    for v_row in select value from jsonb_array_elements(v_rows) as item(value) loop
      if pg_catalog.jsonb_typeof(v_row) <> 'object'
        or not public.jsonb_object_has_exact_keys(v_row, v_def.columns)
        or pg_catalog.jsonb_typeof(v_row -> 'owner_id') <> 'string'
        or v_row ->> 'owner_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or (v_row ->> 'owner_id')::uuid <> v_owner
        or pg_catalog.jsonb_typeof(v_row -> v_def.key_column) <> 'string'
        or v_row ->> v_def.key_column is null
        or (v_def.key_column = 'id' and v_row ->> 'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
        raise exception 'Linha inválida ou de outro proprietário em ' || v_def.table_name using errcode = '42501';
      end if;
    end loop;
    if exists (
      select 1 from (
        select value ->> v_def.key_column as row_key
        from pg_catalog.jsonb_array_elements(v_rows) as item(value)
        group by value ->> v_def.key_column
        having count(*) > 1
      ) duplicated
    ) then
      raise exception 'Chave primária duplicada no pacote: ' || v_def.table_name using errcode = '23505';
    end if;
  end loop;
  if v_total <> (v_manifest ->> 'totalRows')::int or v_total > 50000 then
    raise exception 'Total de linhas não confere.' using errcode = '22023';
  end if;
  if pg_catalog.octet_length(v_manifest::text) + (
    select coalesce(sum(pg_catalog.octet_length(value #>> '{}')), 0)
    from pg_catalog.jsonb_each(v_csv)
  ) > 52428800 then
    raise exception 'Conteúdo descompactado excede 50 MiB.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.validate_backup_package(jsonb) from public, anon, authenticated;
```

- [ ] **Step 3: Criar staging temporária e classificação**

```sql
create or replace function public.stage_backup_package(p_package jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_def record;
  v_index record;
  v_columns text;
  v_stage text;
begin
  perform public.validate_backup_package(p_package);
  drop table if exists pg_temp.backup_classification;
  drop table if exists pg_temp.backup_issues;
  create temp table backup_classification (
    table_name text not null,
    row_key text not null,
    status text not null check (status in ('new','identical','conflict')),
    primary key (table_name, row_key)
  ) on commit drop;
  create temp table backup_issues (
    table_name text not null,
    row_key text not null,
    message text not null,
    primary key (table_name, row_key)
  ) on commit drop;

  for v_def in select * from public.backup_table_registry order by insert_order loop
    v_stage := 'backup_stage_' || v_def.table_name;
    execute format('drop table if exists pg_temp.%I', v_stage);
    execute format(
      'create temp table %I (like public.%I including generated including constraints) on commit drop',
      v_stage, v_def.table_name
    );
    v_columns := pg_catalog.array_to_string(v_def.columns, ',');
    execute format(
      'insert into pg_temp.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)',
      v_stage, v_columns, v_columns, v_def.table_name
    ) using p_package -> 'tables' -> v_def.table_name;
  end loop;

  create index backup_classification_status_idx
    on pg_temp.backup_classification (status, table_name);
  for v_index in select * from (values
    ('leads','cnpj','cnpj_digits'),
    ('leads','phone','phone_canonical'),
    ('leads','whatsapp','whatsapp_canonical'),
    ('clients','cnpj','cnpj_digits'),
    ('clients','phone','phone_canonical'),
    ('clients','whatsapp','whatsapp_canonical'),
    ('contracts','creation','creation_key'),
    ('contracts','source','source_link_id'),
    ('projects','source','source_link_id'),
    ('projects','contract','contract_id'),
    ('lead_client_links','lead','lead_id'),
    ('lead_followups','pending','lead_id, status, due_at'),
    ('lead_digital_checks','pair','lead_id, item'),
    ('client_activities','project','project_id'),
    ('client_activities','contract','contract_id'),
    ('project_tasks','project','project_id'),
    ('project_revisions','project','project_id'),
    ('contract_installments','position','contract_id, position'),
    ('expense_categories','name','owner_id, lower(name)'),
    ('revenue_categories','name','owner_id, lower(name)'),
    ('financial_payments','idempotency','idempotency_key'),
    ('financial_payments','contract_type','contract_id, type'),
    ('financial_payments','original','related_payment_id'),
    ('financial_payment_allocations','pair','payment_id, installment_id'),
    ('financial_payment_allocations','contract','contract_id'),
    ('financial_expenses','category','category_id'),
    ('financial_expenses','project','project_id'),
    ('financial_expenses','contract','contract_id')
  ) as mapping(table_name, suffix, columns) loop
    execute format(
      'create index %I on pg_temp.%I (%s)',
      'backup_stage_' || v_index.table_name || '_' || v_index.suffix || '_idx',
      'backup_stage_' || v_index.table_name,
      v_index.columns
    );
  end loop;
end;
$$;

create or replace function public.add_backup_issue(p_table text, p_key text, p_message text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into pg_temp.backup_issues (table_name, row_key, message)
  values (p_table, p_key, p_message)
  on conflict (table_name, row_key) do update set message = excluded.message;
end;
$$;

revoke all on function public.stage_backup_package(jsonb) from public, anon, authenticated;
revoke all on function public.add_backup_issue(text,text,text) from public, anon, authenticated;

create or replace function public.backup_id_exists(p_table text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_exists boolean;
begin
  if not exists (select 1 from public.backup_table_registry where table_name = p_table and key_column = 'id') then
    raise exception 'Tabela de backup inválida.';
  end if;
  execute format(
    'select exists(select 1 from pg_temp.backup_stage_%I where id = $1 and owner_id = $2) '
    'or exists(select 1 from public.%I where id = $1 and owner_id = $2)',
    p_table, p_table
  ) into v_exists using p_id, v_owner;
  return v_exists;
end;
$$;

create or replace function public.classify_backup_package()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_def record;
  v_stage text;
  v_totals jsonb;
  v_tables jsonb;
  v_issues jsonb;
  v_can_restore boolean;
begin
  for v_def in select * from public.backup_table_registry order by insert_order loop
    v_stage := 'backup_stage_' || v_def.table_name;
    execute format(
      'insert into pg_temp.backup_classification (table_name, row_key, status) '
      'select %L, s.%I::text, case '
      'when e.%I is null then ''new'' '
      'when e.owner_id <> auth.uid() then ''conflict'' '
      'when to_jsonb(e) = to_jsonb(s) then ''identical'' '
      'else ''conflict'' end '
      'from pg_temp.backup_stage_%I s '
      'left join public.%I e on e.%I = s.%I',
      v_def.table_name, v_def.key_column, v_def.key_column,
      v_stage, v_def.table_name,
      v_def.key_column, v_def.key_column
    );
  end loop;
  perform public.backup_unique_issues();
  perform public.backup_relation_issues();
  perform public.backup_semantic_issues();
  update pg_temp.backup_classification c set status = 'conflict'
    where exists (select 1 from pg_temp.backup_issues i
      where i.table_name = c.table_name and i.row_key = c.row_key);
  select jsonb_build_object(
    'new', count(*) filter (where status = 'new'),
    'identical', count(*) filter (where status = 'identical'),
    'conflict', count(*) filter (where status = 'conflict')
  ) into v_totals from pg_temp.backup_classification;
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', table_name,
    'new', count(*) filter (where status = 'new'),
    'identical', count(*) filter (where status = 'identical'),
    'conflict', count(*) filter (where status = 'conflict')
  ) order by table_name), '[]'::jsonb) into v_tables
    from pg_temp.backup_classification group by table_name;
  select coalesce(jsonb_agg(message order by table_name, row_key), '[]'::jsonb)
    into v_issues from (
      select table_name, row_key, table_name || ':' || row_key || ' — ' || message as message
      from pg_temp.backup_issues order by table_name, row_key limit 100
    ) as limited;
  v_can_restore := (v_totals ->> 'conflict')::int = 0
    and not exists (select 1 from pg_temp.backup_issues);
  return jsonb_build_object('can_restore', v_can_restore, 'totals', v_totals, 'tables', v_tables, 'issues', v_issues);
end;
$$;

revoke all on function public.backup_id_exists(text,uuid) from public, anon, authenticated;
revoke all on function public.classify_backup_package() from public, anon, authenticated;
```

A função `classify_backup_package` usa `v_stage` apenas para montar o nome da staging; a atribuição está no argumento de `format` e não altera a classe da linha.

- [ ] **Step 4: Validar unicidade, relações e regras financeiras antes da escrita**

```sql
create or replace function public.backup_unique_issues()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mapping record;
  v_key text;
  v_value text;
begin
  for v_mapping in select * from (values
    ('clients','creation_key'),
    ('contracts','creation_key'),
    ('contracts','source_link_id'),
    ('projects','source_link_id'),
    ('lead_client_links','lead_id'),
    ('financial_payments','idempotency_key')
  ) as mapping(table_name, column_name) loop
    for v_key, v_value in execute format(
      'select s.id::text, s.%I::text from pg_temp.backup_stage_%I s '
      'where s.%I is not null and ('
      'exists(select 1 from public.%I e where e.%I = s.%I and e.id <> s.id) '
      'or exists(select 1 from pg_temp.backup_stage_%I s2 where s2.%I = s.%I and s2.id <> s.id))',
      v_mapping.column_name, v_mapping.table_name, v_mapping.column_name,
      v_mapping.table_name, v_mapping.column_name, v_mapping.column_name,
      v_mapping.table_name, v_mapping.column_name, v_mapping.column_name
    ) loop
      perform public.add_backup_issue(v_mapping.table_name, v_key,
        'Conflito de identificador único: ' || v_mapping.column_name || '.');
    end loop;
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_contract_installments s
    where exists (
      select 1 from public.contract_installments e
        where e.contract_id = s.contract_id and e.position = s.position and e.id <> s.id
    ) or exists (
      select 1 from pg_temp.backup_stage_contract_installments s2
        where s2.contract_id = s.contract_id and s2.position = s.position and s2.id <> s.id
    ) loop
    perform public.add_backup_issue('contract_installments', v_key, 'Posição de parcela já existe.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_financial_payment_allocations s
    where exists (
      select 1 from public.financial_payment_allocations e
        where e.payment_id = s.payment_id and e.installment_id = s.installment_id and e.id <> s.id
    ) or exists (
      select 1 from pg_temp.backup_stage_financial_payment_allocations s2
        where s2.payment_id = s.payment_id and s2.installment_id = s.installment_id and s2.id <> s.id
    ) loop
    perform public.add_backup_issue('financial_payment_allocations', v_key, 'Alocação duplicada para pagamento/parcela.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_lead_digital_checks s
    where exists (
      select 1 from public.lead_digital_checks e
        where e.lead_id = s.lead_id and e.item = s.item and e.id <> s.id
    ) or exists (
      select 1 from pg_temp.backup_stage_lead_digital_checks s2
        where s2.lead_id = s.lead_id and s2.item = s.item and s2.id <> s.id
    ) loop
    perform public.add_backup_issue('lead_digital_checks', v_key, 'Verificação digital duplicada.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_expense_categories s
    where exists (
      select 1 from public.expense_categories e
        where e.owner_id = s.owner_id and lower(e.name) = lower(s.name) and e.id <> s.id
    ) or exists (
      select 1 from pg_temp.backup_stage_expense_categories s2
        where s2.owner_id = s.owner_id and lower(s2.name) = lower(s.name) and s2.id <> s.id
    ) loop
    perform public.add_backup_issue('expense_categories', v_key, 'Nome de categoria de despesa já existe.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_revenue_categories s
    where exists (
      select 1 from public.revenue_categories e
        where e.owner_id = s.owner_id and lower(e.name) = lower(s.name) and e.id <> s.id
    ) or exists (
      select 1 from pg_temp.backup_stage_revenue_categories s2
        where s2.owner_id = s.owner_id and lower(s2.name) = lower(s.name) and s2.id <> s.id
    ) loop
    perform public.add_backup_issue('revenue_categories', v_key, 'Nome de categoria de receita já existe.');
  end loop;

  for v_key in
    select distinct s.id::text from pg_temp.backup_stage_leads s
    where (s.phone_canonical is not null and (
      exists (
        select 1 from public.leads e
        where e.owner_id = s.owner_id and e.id <> s.id
          and (e.phone_canonical = s.phone_canonical or e.whatsapp_canonical = s.phone_canonical)
      ) or exists (
        select 1 from pg_temp.backup_stage_leads e
        where e.id <> s.id
          and (e.phone_canonical = s.phone_canonical or e.whatsapp_canonical = s.phone_canonical)
      )
    )) or (s.whatsapp_canonical is not null and (
      exists (
        select 1 from public.leads e
        where e.owner_id = s.owner_id and e.id <> s.id
          and (e.phone_canonical = s.whatsapp_canonical or e.whatsapp_canonical = s.whatsapp_canonical)
      ) or exists (
        select 1 from pg_temp.backup_stage_leads e
        where e.id <> s.id
          and (e.phone_canonical = s.whatsapp_canonical or e.whatsapp_canonical = s.whatsapp_canonical)
      )
    ))
  loop
    perform public.add_backup_issue('leads', v_key, 'Telefone ou WhatsApp canônico de lead já existe.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_leads s
    where s.cnpj_digits is not null and (
      exists(select 1 from public.leads e where e.owner_id = s.owner_id and e.cnpj_digits = s.cnpj_digits and e.id <> s.id)
      or exists(select 1 from pg_temp.backup_stage_leads e where e.cnpj_digits = s.cnpj_digits and e.id <> s.id)
    )
  loop
    perform public.add_backup_issue('leads', v_key, 'CNPJ canônico de lead já existe.');
  end loop;

  for v_key in select candidate.id::text from pg_temp.backup_stage_clients candidate
    where (candidate.cnpj_digits is not null and (
      exists(select 1 from public.clients e where e.owner_id = candidate.owner_id and e.cnpj_digits = candidate.cnpj_digits and e.id <> candidate.id)
      or exists(select 1 from pg_temp.backup_stage_clients s2 where s2.owner_id = candidate.owner_id and s2.cnpj_digits = candidate.cnpj_digits and s2.id <> candidate.id)
    )) or (candidate.phone_canonical is not null and (
      exists (
        select 1 from public.clients e
        where e.owner_id = candidate.owner_id and e.id <> candidate.id
          and (e.phone_canonical = candidate.phone_canonical or e.whatsapp_canonical = candidate.phone_canonical)
      ) or exists (
        select 1 from pg_temp.backup_stage_clients e
        where e.id <> candidate.id
          and (e.phone_canonical = candidate.phone_canonical or e.whatsapp_canonical = candidate.phone_canonical)
      )
    )) or (candidate.whatsapp_canonical is not null and (
      exists (
        select 1 from public.clients e
        where e.owner_id = candidate.owner_id and e.id <> candidate.id
          and (e.phone_canonical = candidate.whatsapp_canonical or e.whatsapp_canonical = candidate.whatsapp_canonical)
      ) or exists (
        select 1 from pg_temp.backup_stage_clients e
        where e.id <> candidate.id
          and (e.phone_canonical = candidate.whatsapp_canonical or e.whatsapp_canonical = candidate.whatsapp_canonical)
      )
    )) loop
    perform public.add_backup_issue('clients', v_key, 'CNPJ, telefone ou WhatsApp canônico de cliente já existe.');
  end loop;
end;
$$;

create or replace function public.backup_relation_issues()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_id uuid;
  v_contract uuid;
  v_client uuid;
  v_project uuid;
  v_payment uuid;
  v_installment uuid;
  v_source uuid;
  v_category uuid;
begin
  for v_key in select s.id::text from pg_temp.backup_stage_lead_activities s
    where not public.backup_id_exists('leads', s.lead_id) loop
    perform public.add_backup_issue('lead_activities', v_key, 'Lead relacionado não existe.');
  end loop;
  for v_key in select s.id::text from pg_temp.backup_stage_lead_followups s
    where not public.backup_id_exists('leads', s.lead_id) loop
    perform public.add_backup_issue('lead_followups', v_key, 'Lead relacionado não existe.');
  end loop;
  for v_key in select s.id::text from pg_temp.backup_stage_lead_digital_checks s
    where not public.backup_id_exists('leads', s.lead_id) loop
    perform public.add_backup_issue('lead_digital_checks', v_key, 'Lead relacionado não existe.');
  end loop;
  for v_key in select s.id::text from pg_temp.backup_stage_lead_client_links s
    where not public.backup_id_exists('leads', s.lead_id)
      or not public.backup_id_exists('clients', s.client_id) loop
    perform public.add_backup_issue('lead_client_links', v_key, 'Lead ou cliente relacionado não existe.');
  end loop;

  for v_key, v_client, v_source in
    select s.id::text, s.client_id, s.source_link_id from pg_temp.backup_stage_contracts s
  loop
    if not public.backup_id_exists('clients', v_client)
      or (v_source is not null and not (
        exists(select 1 from pg_temp.backup_stage_lead_client_links l where l.id = v_source and l.client_id = v_client)
        or exists(select 1 from public.lead_client_links l where l.id = v_source and l.client_id = v_client and l.owner_id = auth.uid())
      )) then
      perform public.add_backup_issue('contracts', v_key, 'Cliente ou vínculo de origem não existe ou aponta para outro cliente.');
    end if;
  end loop;

  for v_key, v_contract, v_client, v_source in
    select s.id::text, s.contract_id, s.client_id, s.source_link_id from pg_temp.backup_stage_projects s
  loop
    if not public.backup_id_exists('clients', v_client)
      or (v_source is not null and not (
        exists(select 1 from pg_temp.backup_stage_lead_client_links l where l.id = v_source and l.client_id = v_client)
        or exists(select 1 from public.lead_client_links l where l.id = v_source and l.client_id = v_client and l.owner_id = auth.uid())
      ))
      or not (
        exists(select 1 from pg_temp.backup_stage_contracts c where c.id = v_contract and c.client_id = v_client)
        or exists(select 1 from public.contracts c where c.id = v_contract and c.client_id = v_client and c.owner_id = auth.uid())
      ) then
      perform public.add_backup_issue('projects', v_key, 'Cliente/contrato/vínculo de projeto inválido.');
    end if;
  end loop;

  for v_key, v_client, v_project, v_contract in
    select s.id::text, s.client_id, s.project_id, s.contract_id from pg_temp.backup_stage_client_activities s
  loop
    if not public.backup_id_exists('clients', v_client)
      or (v_project is not null and not (
        exists(select 1 from pg_temp.backup_stage_projects p where p.id = v_project and p.client_id = v_client)
        or exists(select 1 from public.projects p where p.id = v_project and p.client_id = v_client and p.owner_id = auth.uid())
      ))
      or (v_contract is not null and not (
        exists(select 1 from pg_temp.backup_stage_contracts c where c.id = v_contract and c.client_id = v_client)
        or exists(select 1 from public.contracts c where c.id = v_contract and c.client_id = v_client and c.owner_id = auth.uid())
      ))
      or (v_project is not null and v_contract is not null and not (
        exists(select 1 from pg_temp.backup_stage_projects p where p.id = v_project and p.contract_id = v_contract)
        or exists(select 1 from public.projects p where p.id = v_project and p.contract_id = v_contract and p.owner_id = auth.uid())
      )) then
      perform public.add_backup_issue('client_activities', v_key, 'Relação de atividade de cliente inválida.');
    end if;
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_project_tasks s
    where not public.backup_id_exists('projects', s.project_id) loop
    perform public.add_backup_issue('project_tasks', v_key, 'Projeto relacionado não existe.');
  end loop;
  for v_key in select s.id::text from pg_temp.backup_stage_project_revisions s
    where not public.backup_id_exists('projects', s.project_id) loop
    perform public.add_backup_issue('project_revisions', v_key, 'Projeto relacionado não existe.');
  end loop;
  for v_key in select s.id::text from pg_temp.backup_stage_contract_installments s
    where not public.backup_id_exists('contracts', s.contract_id) loop
    perform public.add_backup_issue('contract_installments', v_key, 'Contrato relacionado não existe.');
  end loop;

  for v_key, v_contract, v_id, v_category in
    select s.id::text, s.contract_id, s.related_payment_id, s.revenue_category_id from pg_temp.backup_stage_financial_payments s
  loop
    if not public.backup_id_exists('contracts', v_contract)
      or (v_id is not null and not (
        exists(select 1 from pg_temp.backup_stage_financial_payments p where p.id = v_id and p.contract_id = v_contract and p.type = 'receipt')
        or exists(select 1 from public.financial_payments p where p.id = v_id and p.contract_id = v_contract and p.type = 'receipt' and p.owner_id = auth.uid())
      ))
      or (v_category is not null and not (
        exists(select 1 from pg_temp.backup_stage_revenue_categories c where c.id = v_category and c.owner_id = auth.uid())
        or exists(select 1 from public.revenue_categories c where c.id = v_category and c.owner_id = auth.uid())
      )) then
      perform public.add_backup_issue('financial_payments', v_key, 'Contrato, recebimento original ou categoria de receita inválido.');
    end if;
  end loop;

  for v_key, v_payment, v_installment, v_contract in
    select s.id::text, s.payment_id, s.installment_id, s.contract_id
    from pg_temp.backup_stage_financial_payment_allocations s
  loop
    if not (
      exists(select 1 from pg_temp.backup_stage_financial_payments p where p.id = v_payment and p.contract_id = v_contract)
      or exists(select 1 from public.financial_payments p where p.id = v_payment and p.contract_id = v_contract and p.owner_id = auth.uid())
    ) or not (
      exists(select 1 from pg_temp.backup_stage_contract_installments i where i.id = v_installment and i.contract_id = v_contract)
      or exists(select 1 from public.contract_installments i where i.id = v_installment and i.contract_id = v_contract and i.owner_id = auth.uid())
    ) then
      perform public.add_backup_issue('financial_payment_allocations', v_key, 'Pagamento ou parcela de alocação inválido.');
    end if;
  end loop;

  for v_key, v_category, v_project, v_contract in
    select s.id::text, s.category_id, s.project_id, s.contract_id from pg_temp.backup_stage_financial_expenses s
  loop
    if (v_category is not null and not public.backup_id_exists('expense_categories', v_category))
      or (v_project is not null and not public.backup_id_exists('projects', v_project))
      or (v_contract is not null and not public.backup_id_exists('contracts', v_contract))
      or (v_project is not null and v_contract is not null and not (
        exists(select 1 from pg_temp.backup_stage_projects p
          where p.id = v_project and p.contract_id = v_contract)
        or exists(select 1 from public.projects p
          where p.id = v_project and p.contract_id = v_contract and p.owner_id = auth.uid())
      )) then
      perform public.add_backup_issue('financial_expenses', v_key, 'Categoria, projeto ou contrato de despesa inválido ou incoerente.');
    end if;
  end loop;
end;
$$;

create or replace function public.backup_url_decode(p_value text)
returns text
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_output bytea := ''::bytea;
  v_index int := 1;
  v_character text;
begin
  while v_index <= length(p_value) loop
    v_character := substr(p_value, v_index, 1);
    if v_character = '%' then
      if v_index + 2 > length(p_value) or substr(p_value, v_index + 1, 2) !~ '^[0-9a-f]{2}$' then
        return null;
      end if;
      v_output := v_output || pg_catalog.decode(substr(p_value, v_index + 1, 2), 'hex');
      v_index := v_index + 3;
    elsif v_character = '+' then
      v_output := v_output || pg_catalog.decode('20', 'hex');
      v_index := v_index + 1;
    else
      v_output := v_output || pg_catalog.convert_to(v_character, 'UTF8');
      v_index := v_index + 1;
    end if;
  end loop;
  return pg_catalog.convert_from(v_output, 'UTF8');
exception when untranslatable_character then
  return null;
end;
$$;

O validador SQL cobre um subconjunto seguro e determinístico de `normalizeMapsUrl`: hosts Google Maps oficiais, paths/parâmetros reconhecidos, sem credenciais, controles, espaços, barras invertidas ou escapes inválidos. Ele não tenta reproduzir todas as normalizações do navegador. Toda URL gravada ou importada deve primeiro passar por `normalizeMapsUrl` no cliente; o servidor rejeita o que estiver fora desse subconjunto, e `null`/string vazia permanecem ausência não confirmada.

create or replace function public.backup_maps_url_valid(p_value text)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_authority text;
  v_host text;
  v_port text;
  v_path text;
  v_query text;
  v_part text;
  v_name text;
  v_value text;
  v_q text;
  v_query_place_id text;
  v_cid text;
  v_seen_q boolean := false;
  v_seen_query_place_id boolean := false;
  v_seen_cid boolean := false;
begin
  if p_value = '' then return true; end if;
  if p_value !~* '^https?://' or p_value ~ '[[:space:][:cntrl:]\\]'
    or p_value !~* '^(?:[^%]|%[0-9a-f]{2})*$' then return false; end if;
  v_authority := substring(p_value from '^https?://([^/?#]+)');
  if v_authority is null or v_authority = '' or position('@' in v_authority) > 0 then return false; end if;
  v_host := lower(v_authority);
  if position(':' in v_host) > 0 then
    if length(v_host) - length(replace(v_host, ':', '')) <> 1 then return false; end if;
    v_port := split_part(v_host, ':', 2);
    if length(v_port) > 5 or v_port !~ '^[0-9]+$' then return false; end if;
    if v_port::int not between 1 and 65535 then return false; end if;
    v_host := split_part(v_host, ':', 1);
  end if;
  v_host := pg_catalog.regexp_replace(v_host, '[.]$', '');
  if v_host = '' or exists (
    select 1 from pg_catalog.unnest(pg_catalog.string_to_array(v_host, '.')) as label(value)
    where value !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  ) then return false; end if;
  v_path := coalesce(substring(p_value from '^https?://[^/?#]+([^?#]*)'), '/');
  if v_path ~ '(^|/)(?:\.{1,2})(/|$)' or v_path ~* '%2e' then return false; end if;
  v_query := coalesce(substring(p_value from '\?([^#]*)'), '');
  if v_host = 'maps.app.goo.gl' then return length(v_path) > 1; end if;
  if v_host = 'goo.gl' then return v_path ~ '^/maps/[^/]+/?$'; end if;
  if v_host <> 'maps.google.com'
    and v_host !~ '^(?:www\.)?google\.com(?:\.[a-z]{2})?$' then return false; end if;
  if v_host <> 'maps.google.com' and v_path <> '/maps' and v_path !~ '^/maps/' then return false; end if;
  if v_path ~ '^/maps/(?:preview/)?place/[^/]+' then return true; end if;

  for v_part in select value from pg_catalog.regexp_split_to_table(v_query, '&') loop
    v_name := public.backup_url_decode(split_part(v_part, '=', 1));
    if position('=' in v_part) > 0 then
      v_value := public.backup_url_decode(substr(v_part from position('=' in v_part) + 1));
    else
      v_value := '';
    end if;
    if v_name is null or v_value is null then return false; end if;
    if v_name in ('q','query') and not v_seen_q then
      v_q := v_value; v_seen_q := true;
    elsif v_name = 'query_place_id' and not v_seen_query_place_id then
      v_query_place_id := v_value; v_seen_query_place_id := true;
    elsif v_name = 'cid' and not v_seen_cid then
      v_cid := v_value; v_seen_cid := true;
    end if;
  end loop;
  return (v_q is not null and lower(left(v_q, 8)) = 'placeid:' and length(v_q) > 8 and v_q !~ '[[:space:]]')
    or (v_query_place_id is not null and v_query_place_id <> '' and v_query_place_id !~ '[[:space:]]')
    or (v_cid is not null and v_cid ~ '^[0-9]+$');
end;
$$;

revoke all on function public.backup_url_decode(text) from public, anon, authenticated;
revoke all on function public.backup_maps_url_valid(text) from public, anon, authenticated;
grant execute on function public.backup_url_decode(text) to authenticated;
grant execute on function public.backup_maps_url_valid(text) to authenticated;

create or replace function public.backup_service_prices_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  return public.valid_service_prices(p_value);
exception when others then
  return false;
end;
$$;

revoke all on function public.backup_service_prices_valid(jsonb) from public, anon, authenticated;
grant execute on function public.backup_service_prices_valid(jsonb) to authenticated;

create or replace function public.backup_semantic_issues()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_contract uuid;
  v_total numeric;
  v_allocated numeric;
  v_receipts numeric;
  v_refunds numeric;
  v_payment record;
  v_allocation record;
  v_related_payment uuid;
  v_installment_count int;
  v_allocation_sum numeric;
  v_original numeric;
  v_refunded numeric;
  v_installment_amount numeric;
  v_net numeric;
  v_lead uuid;
  v_expected_next_contact timestamptz;
  v_actual_next_contact timestamptz;
begin
  for v_key in select s.owner_id::text from pg_temp.backup_stage_user_settings s
    where not public.backup_preferences_valid(s.preferences)
      or not public.backup_service_prices_valid(s.service_prices)
      or s.whatsapp_template is null or length(s.whatsapp_template) > 4000
      or s.updated_at < s.created_at
  loop
    perform public.add_backup_issue('user_settings', v_key, 'Preferências, preços, template ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_expense_categories s
    where length(s.name) not between 1 and 60 or pg_catalog.btrim(s.name) = ''
  loop
    perform public.add_backup_issue('expense_categories', v_key, 'Nome de categoria inválido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_revenue_categories s
    where length(s.name) not between 1 and 60 or pg_catalog.btrim(s.name) = ''
  loop
    perform public.add_backup_issue('revenue_categories', v_key, 'Nome de categoria inválido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_leads s
    where s.maps_url is not null and s.maps_url <> '' and not public.backup_maps_url_valid(s.maps_url)
  loop
    perform public.add_backup_issue('leads', v_key, 'Link do Maps inválido ou de domínio não permitido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_leads s
    where s.estimated_value is null or s.negotiated_value is null or s.contracted_value is null
      or s.received_value is null or s.estimated_value < 0 or s.negotiated_value < 0
      or s.contracted_value < 0 or s.received_value < 0 or s.score is null
      or s.score < 0 or s.score > 100
  loop
    perform public.add_backup_issue('leads', v_key, 'Valores comerciais ou score inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_leads s
    where s.status not in ('novo','contato_realizado','aguardando_resposta','pediu_informacoes','interessado','negociando','aceitou','ignorou','nao_interessado','follow_up','perdido')
      or s.priority not in ('muito_alta','alta','media','baixa')
      or s.has_website not in ('yes','no','unverified') or s.has_instagram not in ('yes','no','unverified')
      or s.has_facebook not in ('yes','no','unverified') or s.has_digital_menu not in ('yes','no','unverified')
      or s.has_digital_catalog not in ('yes','no','unverified') or s.has_landing_page not in ('yes','no','unverified')
      or s.has_business_whatsapp not in ('yes','no','unverified') or s.updated_at < s.created_at
  loop
    perform public.add_backup_issue('leads', v_key, 'Status, prioridade, tri-state ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_clients s
    where s.status not in ('active','in_project','awaiting_payment','awaiting_approval','project_completed','inactive')
      or s.updated_at < s.created_at
  loop
    perform public.add_backup_issue('clients', v_key, 'Status ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_contracts s
    where s.status not in ('active','cancelled') or s.total_value < 0 or s.updated_at < s.created_at
      or (s.due_date is not null and s.due_date < s.contracted_at)
  loop
    perform public.add_backup_issue('contracts', v_key, 'Status, valor, datas ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_projects s
    where s.status not in ('not_started','planning','in_development','awaiting_client_info','in_review','awaiting_approval','changes_requested','completed','delivered','cancelled')
      or s.priority not in ('very_high','high','medium','low') or s.contracted_value < 0 or s.updated_at < s.created_at
      or (s.start_date is not null and s.due_date is not null and s.due_date < s.start_date)
  loop
    perform public.add_backup_issue('projects', v_key, 'Status, prioridade, valor, datas ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_project_tasks s
    where s.status not in ('pending','in_progress','completed','cancelled')
      or s.priority not in ('very_high','high','medium','low') or s.updated_at < s.created_at
      or (s.start_date is not null and s.due_date is not null and s.due_date < s.start_date)
      or (s.status = 'completed' and s.completed_at is null)
      or (s.status = 'cancelled' and s.cancelled_at is null)
      or (s.status not in ('completed','cancelled') and (s.completed_at is not null or s.cancelled_at is not null))
      or (s.completed_at is not null and s.cancelled_at is not null)
      or (s.category is not null and (length(s.category) not between 1 and 40 or pg_catalog.btrim(s.category) = ''))
  loop
    perform public.add_backup_issue('project_tasks', v_key, 'Status, prioridade, categoria, datas ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_project_revisions s
    where s.status not in ('requested','in_progress','completed','approved')
      or s.updated_at < s.created_at
      or (s.status = 'approved' and (s.completed_at is null or s.approved_at is null))
      or (s.status = 'completed' and (s.completed_at is null or s.approved_at is not null))
      or (s.status in ('requested','in_progress') and (s.completed_at is not null or s.approved_at is not null))
      or (s.completed_at is not null and s.approved_at is not null and s.approved_at < s.completed_at)
  loop
    perform public.add_backup_issue('project_revisions', v_key, 'Status ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_contract_installments s
    where s.position < 0 or s.amount <= 0 or s.due_date is null or s.updated_at < s.created_at
  loop
    perform public.add_backup_issue('contract_installments', v_key, 'Posição, valor, vencimento ou timestamps inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_lead_activities s
    where s.type not in ('primeiro_contato','mensagem','ligacao','resposta','reuniao','proposta','mudanca_status','observacao','follow_up','conversao','outro')
      or (s.user_id is not null and s.user_id <> auth.uid())
  loop
    perform public.add_backup_issue('lead_activities', v_key, 'Tipo ou autor da atividade inválido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_lead_followups s
    where s.status not in ('pendente','concluido','cancelado') or s.updated_at < s.created_at
      or (s.status = 'concluido' and s.completed_at is null)
      or (s.status <> 'concluido' and s.completed_at is not null)
  loop
    perform public.add_backup_issue('lead_followups', v_key, 'Status ou timestamps de conclusão inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_lead_digital_checks s
    where s.item not in ('instagram','website','digital_menu','whatsapp','digital_catalog','business_info')
      or s.verified is null
      or (s.verified is true and s.verified_at is null)
      or (s.verified is false and s.verified_at is not null)
  loop
    perform public.add_backup_issue('lead_digital_checks', v_key, 'Item ou data de verificação inválidos.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_client_activities s
    where s.type not in ('conversion','contact','meeting','approval','status_change','delivery','financial','note')
      or s.created_by is not null and s.created_by <> auth.uid()
  loop
    perform public.add_backup_issue('client_activities', v_key, 'Tipo ou autor da atividade inválido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_financial_payments s
    where s.type not in ('receipt','refund') or s.amount <= 0 or s.idempotency_key is null
      or s.received_at is null or (s.type = 'refund' and s.related_payment_id is null)
      or (s.type = 'receipt' and s.related_payment_id is not null)
      or (s.created_by is not null and s.created_by <> auth.uid())
  loop
    perform public.add_backup_issue('financial_payments', v_key, 'Tipo, valor, idempotência, autor ou recebimento inválido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_financial_payment_allocations s where s.amount <= 0 loop
    perform public.add_backup_issue('financial_payment_allocations', v_key, 'Valor de alocação inválido.');
  end loop;

  for v_key in select s.id::text from pg_temp.backup_stage_financial_expenses s
    where s.amount is null or s.amount < 0 or s.expense_date is null
      or s.status not in ('pending','paid','cancelled') or s.updated_at < s.created_at
      or (s.status = 'paid' and s.paid_at is null)
      or (s.status <> 'paid' and s.paid_at is not null)
      or (s.status = 'cancelled' and s.cancelled_at is null)
      or (s.status <> 'cancelled' and s.cancelled_at is not null)
  loop
    perform public.add_backup_issue('financial_expenses', v_key, 'Status, valor, datas ou timestamps inválidos.');
  end loop;

  for v_contract in select distinct s.contract_id from pg_temp.backup_stage_contract_installments s
    join pg_temp.backup_classification c on c.table_name = 'contract_installments' and c.row_key = s.id::text and c.status = 'new'
  loop
    select total_value into v_total from pg_temp.backup_stage_contracts where id = v_contract;
    if not found then select total_value into v_total from public.contracts where id = v_contract and owner_id = auth.uid(); end if;
    select count(*) into v_installment_count from public.contract_installments where contract_id = v_contract and owner_id = auth.uid();
    v_installment_count := v_installment_count + (
      select count(*) from pg_temp.backup_stage_contract_installments s
      join pg_temp.backup_classification c on c.table_name = 'contract_installments' and c.row_key = s.id::text and c.status = 'new'
      where s.contract_id = v_contract
    );
    select coalesce(sum(amount),0) into v_allocated from public.contract_installments where contract_id = v_contract and owner_id = auth.uid();
    v_allocated := v_allocated + coalesce((
      select sum(s.amount) from pg_temp.backup_stage_contract_installments s
      join pg_temp.backup_classification c on c.table_name = 'contract_installments' and c.row_key = s.id::text and c.status = 'new'
      where s.contract_id = v_contract
    ),0);
    if v_installment_count > 0 and v_allocated <> v_total then
      perform public.add_backup_issue('contracts', v_contract::text, 'Soma das parcelas difere do contrato.');
    end if;
  end loop;

  for v_contract in select distinct s.contract_id from pg_temp.backup_stage_projects s
    join pg_temp.backup_classification c on c.table_name = 'projects' and c.row_key = s.id::text and c.status = 'new'
  loop
    select total_value into v_total from pg_temp.backup_stage_contracts where id = v_contract;
    if not found then select total_value into v_total from public.contracts where id = v_contract and owner_id = auth.uid(); end if;
    select coalesce(sum(contracted_value),0) into v_allocated from public.projects
      where contract_id = v_contract and owner_id = auth.uid() and status <> 'cancelled';
    v_allocated := v_allocated + coalesce((
      select sum(s.contracted_value) from pg_temp.backup_stage_projects s
      join pg_temp.backup_classification c on c.table_name = 'projects' and c.row_key = s.id::text and c.status = 'new'
      where s.contract_id = v_contract and s.status <> 'cancelled'
    ),0);
    if v_allocated > v_total then
      perform public.add_backup_issue('contracts', v_contract::text, 'Projetos excedem o total do contrato.');
    end if;
  end loop;

  for v_contract in select distinct s.contract_id from pg_temp.backup_stage_financial_payments s
    join pg_temp.backup_classification c on c.table_name = 'financial_payments' and c.row_key = s.id::text and c.status = 'new'
  loop
    select total_value into v_total from pg_temp.backup_stage_contracts where id = v_contract;
    if not found then select total_value into v_total from public.contracts where id = v_contract and owner_id = auth.uid(); end if;
    select coalesce(sum(amount) filter (where type = 'receipt'),0) into v_receipts from public.financial_payments
      where contract_id = v_contract and owner_id = auth.uid();
    select coalesce(sum(amount) filter (where type = 'refund'),0) into v_refunds from public.financial_payments
      where contract_id = v_contract and owner_id = auth.uid();
    v_receipts := v_receipts + coalesce((
      select sum(s.amount) from pg_temp.backup_stage_financial_payments s
      join pg_temp.backup_classification c on c.table_name = 'financial_payments' and c.row_key = s.id::text and c.status = 'new'
      where s.contract_id = v_contract and s.type = 'receipt'
    ),0);
    v_refunds := v_refunds + coalesce((
      select sum(s.amount) from pg_temp.backup_stage_financial_payments s
      join pg_temp.backup_classification c on c.table_name = 'financial_payments' and c.row_key = s.id::text and c.status = 'new'
      where s.contract_id = v_contract and s.type = 'refund'
    ),0);
    if v_receipts - v_refunds > v_total then
      perform public.add_backup_issue('contracts', v_contract::text, 'Recebimentos líquidos excedem o contrato.');
    end if;
  end loop;

  for v_payment in select s.* from pg_temp.backup_stage_financial_payments s
    join pg_temp.backup_classification c on c.table_name = 'financial_payments' and c.row_key = s.id::text and c.status = 'new'
    where s.type = 'refund'
  loop
    select coalesce(sum(amount),0) into v_original from public.financial_payments
      where id = v_payment.related_payment_id and owner_id = auth.uid()
        and contract_id = v_payment.contract_id and type = 'receipt';
    if v_original = 0 then
      select coalesce(sum(amount),0) into v_original from pg_temp.backup_stage_financial_payments
        where id = v_payment.related_payment_id and contract_id = v_payment.contract_id and type = 'receipt';
    end if;
    select coalesce(sum(amount),0) into v_refunded from public.financial_payments
      where owner_id = auth.uid() and contract_id = v_payment.contract_id
        and related_payment_id = v_payment.related_payment_id and type = 'refund';
    v_refunded := v_refunded + coalesce((
      select sum(s.amount) from pg_temp.backup_stage_financial_payments s
      join pg_temp.backup_classification c on c.table_name = 'financial_payments' and c.row_key = s.id::text and c.status = 'new'
      where s.owner_id = auth.uid() and s.contract_id = v_payment.contract_id
        and s.related_payment_id = v_payment.related_payment_id and s.type = 'refund'
    ),0);
    if v_original = 0 or v_refunded > v_original then
      perform public.add_backup_issue('financial_payments', v_payment.id::text, 'Estorno excede o recebimento original.');
    end if;
  end loop;

  for v_payment in
    select s.* from pg_temp.backup_stage_financial_payments s
      join pg_temp.backup_classification c on c.table_name = 'financial_payments'
        and c.row_key = s.id::text and c.status = 'new'
    union
    select p.* from public.financial_payments p
      where p.owner_id = auth.uid() and (
        exists (select 1 from pg_temp.backup_stage_financial_payment_allocations a
          join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations'
            and c.row_key = a.id::text and c.status = 'new'
          where a.payment_id = p.id)
        or exists (select 1 from pg_temp.backup_stage_contract_installments i
          join pg_temp.backup_classification c on c.table_name = 'contract_installments'
            and c.row_key = i.id::text and c.status = 'new'
          where i.contract_id = p.contract_id)
      )
  loop
    select count(*) into v_installment_count from public.contract_installments
      where contract_id = v_payment.contract_id and owner_id = auth.uid();
    v_installment_count := v_installment_count + (
      select count(*) from pg_temp.backup_stage_contract_installments s
      join pg_temp.backup_classification c on c.table_name = 'contract_installments'
        and c.row_key = s.id::text and c.status = 'new'
      where s.contract_id = v_payment.contract_id
    );
    select coalesce(sum(amount),0) into v_allocation_sum from public.financial_payment_allocations
      where payment_id = v_payment.id and owner_id = auth.uid();
    v_allocation_sum := v_allocation_sum + coalesce((
      select sum(s.amount) from pg_temp.backup_stage_financial_payment_allocations s
      join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations'
        and c.row_key = s.id::text and c.status = 'new'
      where s.payment_id = v_payment.id
    ),0);
    if (v_installment_count > 0 and v_allocation_sum <> v_payment.amount)
      or (v_installment_count = 0 and v_allocation_sum <> 0) then
      perform public.add_backup_issue('financial_payments', v_payment.id::text, 'Alocações não correspondem ao pagamento/parcelas.');
    end if;
  end loop;

  for v_allocation in select s.* from pg_temp.backup_stage_financial_payment_allocations s
    join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations' and c.row_key = s.id::text and c.status = 'new'
  loop
    select coalesce(sum(amount),0) into v_original from public.financial_payment_allocations a
      join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id
      where a.owner_id = auth.uid() and a.installment_id = v_allocation.installment_id and p.type = 'receipt';
    v_original := v_original + coalesce((
      select sum(a.amount) from pg_temp.backup_stage_financial_payment_allocations a
      join pg_temp.backup_stage_financial_payments p on p.id = a.payment_id and p.type = 'receipt'
      join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations' and c.row_key = a.id::text and c.status = 'new'
      where a.installment_id = v_allocation.installment_id
    ),0);
    select coalesce(sum(amount),0) into v_refunded from public.financial_payment_allocations a
      join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id
      where a.owner_id = auth.uid() and p.type = 'refund' and a.installment_id = v_allocation.installment_id;
    v_refunded := v_refunded + coalesce((
      select sum(a.amount) from pg_temp.backup_stage_financial_payment_allocations a
      join pg_temp.backup_stage_financial_payments p on p.id = a.payment_id and p.type = 'refund'
      join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations' and c.row_key = a.id::text and c.status = 'new'
      where a.installment_id = v_allocation.installment_id
    ),0);
    select amount into v_installment_amount from public.contract_installments where id = v_allocation.installment_id and owner_id = auth.uid();
    if not found then select amount into v_installment_amount from pg_temp.backup_stage_contract_installments where id = v_allocation.installment_id; end if;
    if v_original = 0 or v_refunded > v_original or v_original - v_refunded > v_installment_amount then
      perform public.add_backup_issue('financial_payment_allocations', v_allocation.id::text, 'Alocação/estorno excede o saldo da parcela.');
    end if;

    select p.related_payment_id into v_related_payment from (
      select p.related_payment_id from pg_temp.backup_stage_financial_payments p where p.id = v_allocation.payment_id
      union all
      select p.related_payment_id from public.financial_payments p where p.id = v_allocation.payment_id and p.owner_id = auth.uid()
    ) p limit 1;
    if v_related_payment is not null then
      select coalesce(sum(a.amount),0) into v_original from public.financial_payment_allocations a
        where a.owner_id = auth.uid() and a.payment_id = v_related_payment and a.installment_id = v_allocation.installment_id;
      v_original := v_original + coalesce((
        select sum(a.amount) from pg_temp.backup_stage_financial_payment_allocations a
        join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations'
          and c.row_key = a.id::text and c.status = 'new'
        where a.payment_id = v_related_payment and a.installment_id = v_allocation.installment_id
      ),0);
      select coalesce(sum(a.amount),0) into v_refunded from public.financial_payment_allocations a
        join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id
        where a.owner_id = auth.uid() and p.type = 'refund' and p.related_payment_id = v_related_payment
          and a.installment_id = v_allocation.installment_id;
      v_refunded := v_refunded + coalesce((
        select sum(a.amount) from pg_temp.backup_stage_financial_payment_allocations a
        join pg_temp.backup_stage_financial_payments p on p.id = a.payment_id and p.type = 'refund'
        join pg_temp.backup_classification c on c.table_name = 'financial_payment_allocations'
          and c.row_key = a.id::text and c.status = 'new'
        where p.related_payment_id = v_related_payment and a.installment_id = v_allocation.installment_id
      ),0);
      if v_original = 0 or v_refunded > v_original then
        perform public.add_backup_issue('financial_payment_allocations', v_allocation.id::text,
          'Estorno excede a alocação original na mesma parcela.');
      end if;
    end if;
  end loop;

  for v_lead in
    select id from pg_temp.backup_stage_leads
    union
    select lead_id from pg_temp.backup_stage_lead_followups where lead_id is not null
  loop
    select min(pending.due_at) into v_expected_next_contact from (
      select f.due_at from public.lead_followups f
        where f.lead_id = v_lead and f.owner_id = auth.uid() and f.status = 'pendente'
      union all
      select s.due_at from pg_temp.backup_stage_lead_followups s
        join pg_temp.backup_classification c
          on c.table_name = 'lead_followups' and c.row_key = s.id::text and c.status = 'new'
        where s.lead_id = v_lead and s.status = 'pendente'
    ) pending;
    select s.next_contact_at into v_actual_next_contact from pg_temp.backup_stage_leads s where s.id = v_lead;
    if not found then
      select l.next_contact_at into v_actual_next_contact from public.leads l
        where l.id = v_lead and l.owner_id = auth.uid();
    end if;
    if v_actual_next_contact is distinct from v_expected_next_contact then
      perform public.add_backup_issue('leads', v_lead::text, 'Próximo contato diverge dos follow-ups pendentes.');
    end if;
  end loop;
end;
$$;

revoke all on function public.backup_unique_issues() from public, anon, authenticated;
revoke all on function public.backup_relation_issues() from public, anon, authenticated;
revoke all on function public.backup_semantic_issues() from public, anon, authenticated;
```

- [ ] **Step 5: Criar preview, restore e diagnóstico**

O diagnóstico agregador é `security definer` com `search_path = ''` e somente consultas `stable`. Isso é necessário porque policies de filhos dependem do pai e ocultariam exatamente os órfãos que o diagnóstico deve encontrar. `backup_diagnostic_definition` apenas monta JSON, não executa SQL e não recebe EXECUTE de `authenticated`; o SQL dinâmico é executado somente dentro do agregador, a partir de fragments literais e mappings allowlisted, com filtro explícito por `auth.uid()` em toda leitura de dados do owner. O check `rls.disabled` consulta apenas metadado do registry. Retorne no máximo 20 IDs de amostra por check, sem dados pessoais adicionais.

```sql
create or replace function public.lock_backup_restore()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_contract uuid;
  v_client uuid;
  v_lead uuid;
  v_payment uuid;
  v_installment uuid;
  v_payment_key text;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if pg_catalog.to_regclass('pg_temp.backup_classification') is null
    or exists (select 1 from public.backup_table_registry r
      where pg_catalog.to_regclass('pg_temp.backup_stage_' || r.table_name) is null) then
    raise exception 'Staging de restore ausente.' using errcode = '55000';
  end if;

  drop table if exists pg_temp.backup_restore_contracts;
  drop table if exists pg_temp.backup_restore_clients;
  drop table if exists pg_temp.backup_restore_leads;
  drop table if exists pg_temp.backup_restore_payments;
  drop table if exists pg_temp.backup_restore_installments;
  create temp table backup_restore_contracts (id uuid primary key) on commit drop;
  create temp table backup_restore_clients (id uuid primary key) on commit drop;
  create temp table backup_restore_leads (id uuid primary key) on commit drop;
  create temp table backup_restore_payments (id uuid primary key) on commit drop;
  create temp table backup_restore_installments (id uuid primary key) on commit drop;

  insert into pg_temp.backup_restore_contracts (id)
    select contract_id from (
      select id as contract_id from pg_temp.backup_stage_contracts
      union select contract_id from pg_temp.backup_stage_projects
      union select contract_id from pg_temp.backup_stage_client_activities where contract_id is not null
      union select contract_id from pg_temp.backup_stage_contract_installments
      union select contract_id from pg_temp.backup_stage_financial_payments
      union select contract_id from pg_temp.backup_stage_financial_payment_allocations
      union select contract_id from pg_temp.backup_stage_financial_expenses where contract_id is not null
      union select p.contract_id from public.projects p where p.owner_id = v_owner and (
        exists (select 1 from pg_temp.backup_stage_project_tasks s where s.project_id = p.id)
        or exists (select 1 from pg_temp.backup_stage_project_revisions s where s.project_id = p.id)
        or exists (select 1 from pg_temp.backup_stage_client_activities s where s.project_id = p.id)
        or exists (select 1 from pg_temp.backup_stage_financial_expenses s where s.project_id = p.id)
      )
      union select p.contract_id from public.financial_payments p where p.owner_id = v_owner and (
        exists (select 1 from pg_temp.backup_stage_financial_payment_allocations a where a.payment_id = p.id)
        or exists (select 1 from pg_temp.backup_stage_financial_payments s where s.related_payment_id = p.id)
      )
      union select i.contract_id from public.contract_installments i where i.owner_id = v_owner
        and exists (select 1 from pg_temp.backup_stage_financial_payment_allocations a where a.installment_id = i.id)
    ) as affected(contract_id) where contract_id is not null;

  insert into pg_temp.backup_restore_clients (id)
    select client_id from (
      select id as client_id from pg_temp.backup_stage_clients
      union select client_id from pg_temp.backup_stage_lead_client_links
      union select client_id from pg_temp.backup_stage_contracts
      union select client_id from pg_temp.backup_stage_projects
      union select client_id from pg_temp.backup_stage_client_activities
      union select c.client_id from public.contracts c
        join pg_temp.backup_restore_contracts r on r.id = c.id where c.owner_id = v_owner
    ) as affected(client_id) where client_id is not null;

  insert into pg_temp.backup_restore_leads (id)
    select lead_id from (
      select id as lead_id from pg_temp.backup_stage_leads
      union select lead_id from pg_temp.backup_stage_lead_activities
      union select lead_id from pg_temp.backup_stage_lead_followups
      union select lead_id from pg_temp.backup_stage_lead_digital_checks
      union select lead_id from pg_temp.backup_stage_lead_client_links
    ) as affected(lead_id) where lead_id is not null;

  insert into pg_temp.backup_restore_payments (id)
    select payment_id from (
      select id as payment_id from pg_temp.backup_stage_financial_payments
      union select payment_id from pg_temp.backup_stage_financial_payment_allocations
      union select related_payment_id from pg_temp.backup_stage_financial_payments where related_payment_id is not null
    ) as affected(payment_id) where payment_id is not null;

  insert into pg_temp.backup_restore_installments (id)
    select installment_id from (
      select id as installment_id from pg_temp.backup_stage_contract_installments
      union select installment_id from pg_temp.backup_stage_financial_payment_allocations
    ) as affected(installment_id) where installment_id is not null;

  for v_payment_key in
    select distinct p.idempotency_key::text from pg_temp.backup_restore_payments r
      join public.financial_payments p on p.id = r.id and p.owner_id = v_owner
    union
    select distinct s.idempotency_key::text from pg_temp.backup_stage_financial_payments s
    order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      v_owner::text || ':payment:' || v_payment_key, 0));
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':clients', 0));
  for v_contract in select id from pg_temp.backup_restore_contracts order by id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      v_owner::text || ':contract:' || v_contract::text, 0));
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':restore', 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_owner::text || ':project_tasks', 0));

  for v_client in select id from pg_temp.backup_restore_clients order by id loop
    perform c.id from public.clients c where c.id = v_client and c.owner_id = v_owner for update;
  end loop;
  for v_contract in select id from pg_temp.backup_restore_contracts order by id loop
    perform c.id from public.contracts c where c.id = v_contract and c.owner_id = v_owner for update;
  end loop;
  for v_lead in select id from pg_temp.backup_restore_leads order by id loop
    perform l.id from public.leads l where l.id = v_lead and l.owner_id = v_owner for update;
  end loop;
  for v_payment in select id from pg_temp.backup_restore_payments order by id loop
    perform p.id from public.financial_payments p where p.id = v_payment and p.owner_id = v_owner for update;
  end loop;
  for v_installment in select id from pg_temp.backup_restore_installments order by id loop
    perform i.id from public.contract_installments i where i.id = v_installment and i.owner_id = v_owner for update;
  end loop;
  perform p.id from public.projects p where p.owner_id = v_owner and (
    p.id in (select id from pg_temp.backup_stage_projects)
    or exists (select 1 from pg_temp.backup_stage_project_tasks s where s.project_id = p.id)
    or exists (select 1 from pg_temp.backup_stage_project_revisions s where s.project_id = p.id)
    or exists (select 1 from pg_temp.backup_stage_client_activities s where s.project_id = p.id)
    or exists (select 1 from pg_temp.backup_stage_financial_expenses s where s.project_id = p.id)
  ) order by p.id for update;
end;
$$;

revoke all on function public.lock_backup_restore() from public, anon, authenticated;

create or replace function public.restore_backup_financial_rows()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_table text;
  v_stage text;
  v_columns text;
  v_count int;
  v_inserted jsonb := '{}'::jsonb;
begin
  if v_owner is null or current_setting('ber.restore', true) is distinct from 'on' then
    raise exception 'Restore financeiro fora do contexto de restore.' using errcode = '42501';
  end if;
  foreach v_table in array array['expense_categories','revenue_categories','contract_installments'] loop
    v_stage := 'backup_stage_' || v_table;
    select pg_catalog.array_to_string(columns, ',') into v_columns
      from public.backup_table_registry where table_name = v_table;
    execute format(
      'insert into public.%I (%s) select %s from pg_temp.%I s '
      'join pg_temp.backup_classification c on c.table_name = %L and c.row_key = s.id::text '
      'where c.status = ''new'' order by s.id',
      v_table, v_columns, v_columns, v_stage, v_table
    );
    get diagnostics v_count = row_count;
    v_inserted := jsonb_set(v_inserted, array[v_table], to_jsonb(v_count), true);
  end loop;

  v_stage := 'backup_stage_financial_payments';
  select pg_catalog.array_to_string(columns, ',') into v_columns
    from public.backup_table_registry where table_name = 'financial_payments';
  foreach v_table in array array['receipt','refund'] loop
    execute format(
      'insert into public.financial_payments (%s) select %s from pg_temp.%I s '
      'join pg_temp.backup_classification c on c.table_name = ''financial_payments'' and c.row_key = s.id::text '
      'where c.status = ''new'' and s.type = %L order by s.id',
      v_columns, v_columns, v_stage, v_table
    );
    get diagnostics v_count = row_count;
    if v_table = 'receipt' then
      v_inserted := jsonb_set(v_inserted, array['financial_payments'], to_jsonb(v_count), true);
    else
      v_inserted := jsonb_set(v_inserted, array['financial_payments'],
        to_jsonb((v_inserted ->> 'financial_payments')::int + v_count), true);
    end if;
  end loop;

  foreach v_table in array array['financial_payment_allocations','financial_expenses'] loop
    v_stage := 'backup_stage_' || v_table;
    select pg_catalog.array_to_string(columns, ',') into v_columns
      from public.backup_table_registry where table_name = v_table;
    execute format(
      'insert into public.%I (%s) select %s from pg_temp.%I s '
      'join pg_temp.backup_classification c on c.table_name = %L and c.row_key = s.id::text '
      'where c.status = ''new'' order by s.id',
      v_table, v_columns, v_columns, v_stage, v_table
    );
    get diagnostics v_count = row_count;
    v_inserted := jsonb_set(v_inserted, array[v_table], to_jsonb(v_count), true);
  end loop;
  return v_inserted;
end;
$$;

revoke all on function public.restore_backup_financial_rows() from public, anon, authenticated;

create or replace function public.preview_backup_restore(p_package jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_classification jsonb;
begin
  perform public.validate_backup_package(p_package);
  perform public.stage_backup_package(p_package);
  v_classification := public.classify_backup_package();
  v_hash := public.backup_package_hash(p_package);
  return v_classification || jsonb_build_object('preview_id', v_hash, 'package_hash', v_hash);
end;
$$;

create or replace function public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_hash text;
  v_restore_id uuid := gen_random_uuid();
  v_classification jsonb;
  v_def record;
  v_columns text;
  v_stage text;
  v_count int;
  v_inserted jsonb := '{}'::jsonb;
  v_financial jsonb;
  v_audit_id uuid;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if p_confirmation is distinct from 'RESTAURAR' then raise exception 'Confirmação inválida.' using errcode = '22023'; end if;
  if pg_catalog.to_regclass('public.audit_events') is null
    or pg_catalog.to_regprocedure('public.write_audit_event(uuid,uuid,text,text,text,jsonb)') is null then
    raise exception 'Auditoria 0013 é obrigatória antes do restore.' using errcode = '42501';
  end if;
  perform public.validate_backup_package(p_package);
  v_hash := public.backup_package_hash(p_package);
  if p_preview_hash is null or p_preview_hash !~ '^[0-9a-f]{64}$'
    or p_preview_hash = repeat('0', 64) or p_preview_hash <> v_hash then
    raise exception 'Hash da prévia não confere.';
  end if;

  perform public.stage_backup_package(p_package);
  perform public.lock_backup_restore();

  v_classification := public.classify_backup_package();
  if not (v_classification ->> 'can_restore')::bool then
    raise exception 'Restore abortado: existem conflitos ou relações inválidas.' using errcode = '23514';
  end if;

  perform set_config('ber.restore', 'on', true);
  for v_def in
    select * from public.backup_table_registry
    where table_name not in ('contract_installments','expense_categories','revenue_categories',
      'financial_payments','financial_payment_allocations','financial_expenses')
    order by insert_order
  loop
    v_stage := 'backup_stage_' || v_def.table_name;
    v_columns := pg_catalog.array_to_string(v_def.columns, ',');
    execute format(
      'insert into public.%I (%s) select %s from pg_temp.%I s '
      'join pg_temp.backup_classification c on c.table_name = %L and c.row_key = s.%I::text '
      'where c.status = ''new'' order by s.%I',
      v_def.table_name, v_columns, v_columns, v_stage, v_def.table_name, v_def.key_column, v_def.key_column
    );
    get diagnostics v_count = row_count;
    v_inserted := jsonb_set(v_inserted, array[v_def.table_name], to_jsonb(v_count), true);
  end loop;
  v_financial := public.restore_backup_financial_rows();
  v_inserted := v_inserted || v_financial;
  perform set_config('ber.restore', 'off', true);
  v_audit_id := public.write_audit_event(v_owner, v_owner, 'backup.restore', 'backup', v_hash,
    jsonb_build_object('backup_id', v_hash, 'restore_id', v_restore_id::text,
      'count', (v_classification -> 'totals' ->> 'new')::int));
  return jsonb_build_object('inserted', v_inserted, 'audit_event_id', v_audit_id);
exception
  when others then
    perform set_config('ber.restore', 'off', true);
    raise;
end;
$$;

create or replace function public.backup_diagnostic_definition(
  p_code text, p_severity text, p_key text, p_from text, p_where text
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('code', p_code, 'severity', p_severity,
    'key', p_key, 'from', p_from, 'where', p_where);
$$;

revoke all on function public.backup_diagnostic_definition(text,text,text,text,text) from public, anon, authenticated;

create or replace function public.backup_owner_exists(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_owner is null or p_owner is distinct from auth.uid() then false
    else exists (select 1 from auth.users u where u.id = p_owner)
  end;
$$;

revoke all on function public.backup_owner_exists(uuid) from public, anon, authenticated;
grant execute on function public.backup_owner_exists(uuid) to authenticated;

create or replace function public.get_backup_diagnostics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_owner_literal text;
  v_definitions jsonb := '[]'::jsonb;
  v_diagnostics jsonb := '[]'::jsonb;
  v_definition jsonb;
  v_count bigint;
  v_samples jsonb;
  v_mapping record;
  v_column record;
  v_required text;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  v_owner_literal := pg_catalog.quote_literal(v_owner::text);

  v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
    'rls.disabled', 'critical', 'r.table_name',
    'public.backup_table_registry r join pg_catalog.pg_class c on c.oid = pg_catalog.to_regclass(''public.'' || r.table_name)',
    'not c.relrowsecurity'));

  for v_mapping in select * from public.backup_table_registry loop
    v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
      'orphan.owner.' || v_mapping.table_name, 'critical',
      format('coalesce(c.%I::text,c.owner_id::text)', v_mapping.key_column),
      format('public.%I c', v_mapping.table_name),
      format('c.owner_id = %s and not public.backup_owner_exists(c.owner_id)', v_owner_literal)));
  end loop;

  for v_mapping in select * from public.backup_table_registry
    where 'created_at' = any(columns) loop
    v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
      'invalid.timestamps.' || v_mapping.table_name, 'warning',
      format('coalesce(c.%I::text,c.owner_id::text)', v_mapping.key_column),
      format('public.%I c', v_mapping.table_name),
      format('c.owner_id = %s and (c.created_at is null%s)', v_owner_literal,
        case when 'updated_at' = any(v_mapping.columns)
          then ' or c.updated_at is null or c.updated_at < c.created_at' else '' end)));
  end loop;

  for v_mapping in select * from public.backup_table_registry loop
    v_required := '';
    for v_column in
      select a.attname from pg_catalog.pg_attribute a
        where a.attrelid = pg_catalog.to_regclass(format('public.%I', v_mapping.table_name))
          and a.attnum > 0 and not a.attisdropped and not a.attgenerated
          and a.attname = any(v_mapping.required_columns)
        order by a.attnum
    loop
      v_required := v_required || case when v_required = '' then '' else ' or ' end
        || format('c.%I is null', v_column.attname);
    end loop;
    if v_required <> '' then
      v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
        'invalid.required_fields.' || v_mapping.table_name, 'critical',
        format('coalesce(c.%I::text,c.owner_id::text)', v_mapping.key_column),
        format('public.%I c', v_mapping.table_name),
        format('c.owner_id = %s and (%s)', v_owner_literal, v_required)));
    end if;
  end loop;

  for v_mapping in select * from (values
    ('lead_activities','lead_id','leads'), ('lead_followups','lead_id','leads'),
    ('lead_digital_checks','lead_id','leads'), ('lead_client_links','lead_id','leads'),
    ('lead_client_links','client_id','clients'), ('contracts','client_id','clients'),
    ('contracts','source_link_id','lead_client_links'),
    ('projects','client_id','clients'), ('projects','contract_id','contracts'),
    ('projects','source_link_id','lead_client_links'),
    ('client_activities','client_id','clients'), ('client_activities','project_id','projects'),
    ('client_activities','contract_id','contracts'), ('project_tasks','project_id','projects'),
    ('project_revisions','project_id','projects'), ('contract_installments','contract_id','contracts'),
    ('financial_payments','contract_id','contracts'), ('financial_payments','related_payment_id','financial_payments'),
    ('financial_payments','revenue_category_id','revenue_categories'),
    ('financial_payment_allocations','contract_id','contracts'),
    ('financial_payment_allocations','payment_id','financial_payments'),
    ('financial_payment_allocations','installment_id','contract_installments'),
    ('financial_expenses','category_id','expense_categories'), ('financial_expenses','project_id','projects'),
    ('financial_expenses','contract_id','contracts')
  ) as mapping(child_table, child_column, parent_table) loop
    v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
      'orphan.' || v_mapping.child_table || '.' || v_mapping.child_column, 'critical', 'c.id::text',
      format('public.%I c left join public.%I p on p.id = c.%I',
        v_mapping.child_table, v_mapping.parent_table, v_mapping.child_column),
      format('c.owner_id = %s and c.%I is not null and (p.id is null or p.owner_id <> c.owner_id)',
        v_owner_literal, v_mapping.child_column)));
  end loop;

  for v_mapping in select * from (values
    ('clients','creation_key'), ('contracts','creation_key'), ('contracts','source_link_id'),
    ('projects','source_link_id'), ('financial_payments','idempotency_key'), ('lead_client_links','lead_id')
  ) as mapping(table_name, column_name) loop
    v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
      'duplicate.' || v_mapping.table_name || '.' || v_mapping.column_name, 'critical', 's.id::text',
      format('public.%I s', v_mapping.table_name),
      format('s.owner_id = %s and s.%I is not null and exists ('
        'select 1 from public.%I e where e.%I = s.%I and e.id <> s.id)',
        v_owner_literal, v_mapping.column_name, v_mapping.table_name, v_mapping.column_name, v_mapping.column_name)));
  end loop;

  for v_mapping in select * from (values
    ('clients','phone_canonical'), ('clients','whatsapp_canonical'), ('clients','cnpj_digits')
  ) as mapping(table_name, column_name) loop
    v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
      'duplicate.' || v_mapping.table_name || '.' || v_mapping.column_name, 'critical', 's.id::text',
      format('public.%I s', v_mapping.table_name),
      format('s.owner_id = %s and s.%I is not null and exists ('
        'select 1 from public.%I e where e.owner_id = s.owner_id and e.%I = s.%I and e.id <> s.id)',
        v_owner_literal, v_mapping.column_name, v_mapping.table_name, v_mapping.column_name, v_mapping.column_name)));
  end loop;

  for v_mapping in select * from (values
    ('expense_categories','name'), ('revenue_categories','name')
  ) as mapping(table_name, column_name) loop
    v_definitions := v_definitions || jsonb_build_array(public.backup_diagnostic_definition(
      'duplicate.' || v_mapping.table_name || '.name', 'warning', 's.id::text',
      format('public.%I s', v_mapping.table_name),
      format('s.owner_id = %s and exists (select 1 from public.%I e '
        'where e.owner_id = s.owner_id and lower(e.name) = lower(s.name) and e.id <> s.id)',
        v_owner_literal, v_mapping.table_name)));
  end loop;

  v_definitions := v_definitions || jsonb_build_array(
    public.backup_diagnostic_definition('duplicate.leads.contact', 'warning', 's.id::text',
      'public.leads s',
      format('s.owner_id = %s and ('
        '(s.phone_canonical is not null and exists (select 1 from public.leads e '
        'where e.owner_id = s.owner_id and e.id <> s.id and '
        '(e.phone_canonical = s.phone_canonical or e.whatsapp_canonical = s.phone_canonical))) or '
        '(s.whatsapp_canonical is not null and exists (select 1 from public.leads e '
        'where e.owner_id = s.owner_id and e.id <> s.id and '
        '(e.phone_canonical = s.whatsapp_canonical or e.whatsapp_canonical = s.whatsapp_canonical))))', v_owner_literal)),
    public.backup_diagnostic_definition('duplicate.leads.cnpj', 'warning', 's.id::text', 'public.leads s',
      format('s.owner_id = %s and s.cnpj_digits is not null '
        'and exists (select 1 from public.leads e where e.owner_id = s.owner_id and e.id <> s.id '
        'and e.cnpj_digits = s.cnpj_digits)', v_owner_literal)),
    public.backup_diagnostic_definition('duplicate.clients.contact', 'warning', 's.id::text',
      'public.clients s',
      format('s.owner_id = %s and ('
        '(s.phone_canonical is not null and exists (select 1 from public.clients e '
        'where e.owner_id = s.owner_id and e.id <> s.id and '
        '(e.phone_canonical = s.phone_canonical or e.whatsapp_canonical = s.phone_canonical))) or '
        '(s.whatsapp_canonical is not null and exists (select 1 from public.clients e '
        'where e.owner_id = s.owner_id and e.id <> s.id and '
        '(e.phone_canonical = s.whatsapp_canonical or e.whatsapp_canonical = s.whatsapp_canonical))))', v_owner_literal)),
    public.backup_diagnostic_definition('duplicate.contract_installments.position', 'critical', 's.id::text',
      'public.contract_installments s',
      format('s.owner_id = %s and exists (select 1 from public.contract_installments e '
        'where e.owner_id = s.owner_id and e.contract_id = s.contract_id and e.position = s.position and e.id <> s.id)', v_owner_literal)),
    public.backup_diagnostic_definition('duplicate.financial_payment_allocations.pair', 'critical', 's.id::text',
      'public.financial_payment_allocations s',
      format('s.owner_id = %s and exists (select 1 from public.financial_payment_allocations e '
        'where e.owner_id = s.owner_id and e.payment_id = s.payment_id and e.installment_id = s.installment_id and e.id <> s.id)', v_owner_literal)),
    public.backup_diagnostic_definition('duplicate.lead_digital_checks.pair', 'warning', 's.id::text',
      'public.lead_digital_checks s',
      format('s.owner_id = %s and exists (select 1 from public.lead_digital_checks e '
        'where e.owner_id = s.owner_id and e.lead_id = s.lead_id and e.item = s.item and e.id <> s.id)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.preferences', 'critical', 's.owner_id::text', 'public.user_settings s',
      format('s.owner_id = %s and not public.backup_preferences_valid(s.preferences)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.service_prices', 'critical', 's.owner_id::text', 'public.user_settings s',
      format('s.owner_id = %s and not public.backup_service_prices_valid(s.service_prices)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.whatsapp_template', 'critical', 's.owner_id::text', 'public.user_settings s',
      format('s.owner_id = %s and (s.whatsapp_template is null or length(s.whatsapp_template) > 4000)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.maps_url', 'warning', 's.id::text', 'public.leads s',
      format('s.owner_id = %s and s.maps_url is not null and s.maps_url <> '''' and not public.backup_maps_url_valid(s.maps_url)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.next_contact_at', 'critical', 'l.id::text',
      'public.leads l left join lateral (select min(f.due_at) as due_at from public.lead_followups f '
      'where f.lead_id = l.id and f.owner_id = l.owner_id and f.status = ''pendente'') pending on true',
      format('l.owner_id = %s and l.next_contact_at is distinct from pending.due_at', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.project_contract', 'critical', 'p.id::text',
      'public.projects p join public.contracts c on c.id = p.contract_id',
      format('p.owner_id = %s and (c.owner_id <> p.owner_id or c.client_id <> p.client_id)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.source_link_client', 'critical', 'x.id::text',
      '(select s.id from public.contracts s join public.lead_client_links l on l.id = s.source_link_id '
      'where s.owner_id = ' || v_owner_literal || ' and (l.owner_id <> s.owner_id or l.client_id <> s.client_id) '
      'union all select p.id from public.projects p join public.lead_client_links l on l.id = p.source_link_id '
      'where p.owner_id = ' || v_owner_literal || ' and (l.owner_id <> p.owner_id or l.client_id <> p.client_id)) x', 'true'),
    public.backup_diagnostic_definition('invalid.client_activity_chain', 'critical', 'a.id::text', 'public.client_activities a',
      format('a.owner_id = %s and ('
        '(a.project_id is not null and not exists (select 1 from public.projects p where p.id = a.project_id '
        'and p.owner_id = a.owner_id and p.client_id = a.client_id)) or '
        '(a.contract_id is not null and not exists (select 1 from public.contracts c where c.id = a.contract_id '
        'and c.owner_id = a.owner_id and c.client_id = a.client_id)) or '
        '(a.project_id is not null and a.contract_id is not null and not exists (select 1 from public.projects p '
        'where p.id = a.project_id and p.owner_id = a.owner_id and p.contract_id = a.contract_id)))', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.expense_links', 'critical', 'e.id::text', 'public.financial_expenses e',
      format('e.owner_id = %s and ('
        '(e.project_id is not null and (not exists (select 1 from public.projects p where p.id = e.project_id '
        'and p.owner_id = e.owner_id) or (e.contract_id is not null and not exists (select 1 from public.projects p '
        'where p.id = e.project_id and p.owner_id = e.owner_id and p.contract_id = e.contract_id)))) or '
        '(e.project_id is not null and e.contract_id is not null and not exists (select 1 from public.projects p '
        'join public.contracts c on c.id = e.contract_id and c.owner_id = e.owner_id '
        'where p.id = e.project_id and p.owner_id = e.owner_id and p.contract_id = e.contract_id and p.client_id = c.client_id)))', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.allocation_contract', 'critical', 'a.id::text',
      'public.financial_payment_allocations a join public.financial_payments p on p.id = a.payment_id '
      'join public.contract_installments i on i.id = a.installment_id',
      format('a.owner_id = %s and (p.contract_id <> a.contract_id or i.contract_id <> a.contract_id '
        'or p.owner_id <> a.owner_id or i.owner_id <> a.owner_id)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.refund_chain', 'critical', 'p.id::text',
      'public.financial_payments p left join public.financial_payments r on r.id = p.related_payment_id',
      format('p.owner_id = %s and p.type = ''refund'' and (r.id is null or r.type <> ''receipt'' '
        'or r.contract_id <> p.contract_id or r.owner_id <> p.owner_id)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.project_allocation', 'critical', 'c.id::text', 'public.contracts c',
      format('c.owner_id = %s and coalesce((select sum(p2.contracted_value) from public.projects p2 '
        'where p2.contract_id = c.id and p2.owner_id = c.owner_id and p2.status <> ''cancelled''),0) > c.total_value', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.installment_sum', 'critical', 'c.id::text', 'public.contracts c',
      format('c.owner_id = %s and exists (select 1 from public.contract_installments i where i.contract_id = c.id and i.owner_id = c.owner_id) '
        'and (select coalesce(sum(i.amount),0) from public.contract_installments i where i.contract_id = c.id and i.owner_id = c.owner_id) <> c.total_value', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.contract_receipts', 'critical', 'c.id::text', 'public.contracts c',
      format('c.owner_id = %s and coalesce((select sum(p.amount) filter (where p.type = ''receipt'') - '
        'sum(p.amount) filter (where p.type = ''refund'') from public.financial_payments p '
        'where p.contract_id = c.id and p.owner_id = c.owner_id),0) > c.total_value', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.payment_allocation', 'critical', 'p.id::text', 'public.financial_payments p',
      format('p.owner_id = %s and coalesce((select sum(a.amount) from public.financial_payment_allocations a '
        'where a.payment_id = p.id and a.owner_id = p.owner_id),0) <> case when exists ('
        'select 1 from public.contract_installments i where i.contract_id = p.contract_id and i.owner_id = p.owner_id'
        ') then p.amount else 0 end', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.refund_total', 'critical', 'p.id::text', 'public.financial_payments p',
      format('p.owner_id = %s and p.type = ''refund'' and p.amount > coalesce(('
        'select r.amount - coalesce((select sum(r2.amount) from public.financial_payments r2 '
        'where r2.related_payment_id = r.id and r2.type = ''refund'' and r2.owner_id = r.owner_id and r2.id <> p.id),0) '
        'from public.financial_payments r where r.id = p.related_payment_id and r.type = ''receipt'' and r.owner_id = p.owner_id),0)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.installment_net', 'critical', 'i.id::text', 'public.contract_installments i',
      format('i.owner_id = %s and (i.amount is null or ('
        'coalesce((select sum(a.amount) from public.financial_payment_allocations a '
        'join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id '
        'where a.installment_id = i.id and a.owner_id = i.owner_id and p.type = ''receipt''),0) - '
        'coalesce((select sum(a.amount) from public.financial_payment_allocations a '
        'join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id '
        'where a.installment_id = i.id and a.owner_id = i.owner_id and p.type = ''refund''),0)) < 0 or ('
        'coalesce((select sum(a.amount) from public.financial_payment_allocations a '
        'join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id '
        'where a.installment_id = i.id and a.owner_id = i.owner_id and p.type = ''receipt''),0) - '
        'coalesce((select sum(a.amount) from public.financial_payment_allocations a '
        'join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id '
        'where a.installment_id = i.id and a.owner_id = i.owner_id and p.type = ''refund''),0)) > i.amount)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.refund_allocation', 'critical', 'a.id::text',
      'public.financial_payment_allocations a join public.financial_payments p on p.id = a.payment_id',
      format('a.owner_id = %s and p.type = ''refund'' and ('
        'not exists (select 1 from public.financial_payment_allocations original where original.payment_id = p.related_payment_id '
        'and original.installment_id = a.installment_id and original.owner_id = a.owner_id) or '
        'coalesce((select sum(r.amount) from public.financial_payment_allocations r '
        'join public.financial_payments rp on rp.id = r.payment_id and rp.owner_id = r.owner_id '
        'where rp.type = ''refund'' and rp.related_payment_id = p.related_payment_id '
        'and r.installment_id = a.installment_id and r.owner_id = a.owner_id),0) > '
        'coalesce((select sum(o.amount) from public.financial_payment_allocations o '
        'where o.payment_id = p.related_payment_id and o.installment_id = a.installment_id and o.owner_id = a.owner_id),0))', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.values', 'critical', 'x.id::text',
      '(select id from public.contracts where owner_id = ' || v_owner_literal || ' and (total_value is null or total_value < 0) '
      'union all select id from public.projects where owner_id = ' || v_owner_literal || ' and (contracted_value is null or contracted_value < 0) '
      'union all select id from public.contract_installments where owner_id = ' || v_owner_literal || ' and (amount is null or amount <= 0 or position is null or position < 0) '
      'union all select id from public.financial_payments where owner_id = ' || v_owner_literal || ' and (amount is null or amount <= 0) '
      'union all select id from public.financial_payment_allocations where owner_id = ' || v_owner_literal || ' and (amount is null or amount <= 0) '
      'union all select id from public.financial_expenses where owner_id = ' || v_owner_literal || ' and (amount is null or amount < 0)) x', 'true'),
    public.backup_diagnostic_definition('invalid.lead_values', 'critical', 's.id::text', 'public.leads s',
      format('s.owner_id = %s and (s.estimated_value is null or s.negotiated_value is null or s.contracted_value is null '
        'or s.received_value is null or s.estimated_value < 0 or s.negotiated_value < 0 or s.contracted_value < 0 '
        'or s.received_value < 0 or s.score is null or s.score < 0 or s.score > 100)', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.statuses', 'critical', 'x.id::text',
      '(select id from public.leads where owner_id = ' || v_owner_literal || ' and (status is null or status not in ('
      '''novo'',''contato_realizado'',''aguardando_resposta'',''pediu_informacoes'',''interessado'',''negociando'',''aceitou'',''ignorou'',''nao_interessado'',''follow_up'',''perdido'') '
      'or priority is null or priority not in (''muito_alta'',''alta'',''media'',''baixa'') '
      'or has_website is null or has_website not in (''yes'',''no'',''unverified'') '
      'or has_instagram is null or has_instagram not in (''yes'',''no'',''unverified'') '
      'or has_facebook is null or has_facebook not in (''yes'',''no'',''unverified'') '
      'or has_digital_menu is null or has_digital_menu not in (''yes'',''no'',''unverified'') '
      'or has_digital_catalog is null or has_digital_catalog not in (''yes'',''no'',''unverified'') '
      'or has_landing_page is null or has_landing_page not in (''yes'',''no'',''unverified'') '
      'or has_business_whatsapp is null or has_business_whatsapp not in (''yes'',''no'',''unverified'')) '
      'union all select id from public.clients where owner_id = ' || v_owner_literal || ' and (status is null or status not in ('
      '''active'',''in_project'',''awaiting_payment'',''awaiting_approval'',''project_completed'',''inactive'')) '
      'union all select id from public.contracts where owner_id = ' || v_owner_literal || ' and (status is null or status not in (''active'',''cancelled'')) '
      'union all select id from public.projects where owner_id = ' || v_owner_literal || ' and (status is null or status not in ('
      '''not_started'',''planning'',''in_development'',''awaiting_client_info'',''in_review'',''awaiting_approval'',''changes_requested'',''completed'',''delivered'',''cancelled'') '
      'or priority is null or priority not in (''very_high'',''high'',''medium'',''low'')) '
      'union all select id from public.project_tasks where owner_id = ' || v_owner_literal || ' and (status is null or status not in ('
      '''pending'',''in_progress'',''completed'',''cancelled'') or priority is null or priority not in (''very_high'',''high'',''medium'',''low'')) '
      'union all select id from public.project_revisions where owner_id = ' || v_owner_literal || ' and (status is null or status not in ('
      '''requested'',''in_progress'',''completed'',''approved'')) '
      'union all select id from public.lead_followups where owner_id = ' || v_owner_literal || ' and (status is null or status not in (''pendente'',''concluido'',''cancelado'')) '
      'union all select id from public.lead_activities where owner_id = ' || v_owner_literal || ' and (type is null or type not in ('
      '''primeiro_contato'',''mensagem'',''ligacao'',''resposta'',''reuniao'',''proposta'',''mudanca_status'',''observacao'',''follow_up'',''conversao'',''outro'')) '
      'union all select id from public.client_activities where owner_id = ' || v_owner_literal || ' and (type is null or type not in ('
      '''conversion'',''contact'',''meeting'',''approval'',''status_change'',''delivery'',''financial'',''note'')) '
      'union all select id from public.lead_digital_checks where owner_id = ' || v_owner_literal || ' and (item is null or item not in ('
      '''instagram'',''website'',''digital_menu'',''whatsapp'',''digital_catalog'',''business_info'')) '
      'union all select id from public.financial_payments where owner_id = ' || v_owner_literal || ' and (type is null or type not in (''receipt'',''refund'')) '
      'union all select id from public.financial_expenses where owner_id = ' || v_owner_literal || ' and (status is null or status not in (''pending'',''paid'',''cancelled''))) x', 'true'),
    public.backup_diagnostic_definition('invalid.dates', 'critical', 'x.id::text',
      '(select id from public.contracts where owner_id = ' || v_owner_literal || ' and (contracted_at is null or (due_date is not null and due_date < contracted_at)) '
      'union all select id from public.projects where owner_id = ' || v_owner_literal || ' and (start_date is not null and due_date is not null and due_date < start_date) '
      'union all select id from public.project_tasks where owner_id = ' || v_owner_literal || ' and (start_date is not null and due_date is not null and due_date < start_date) '
      'union all select id from public.contract_installments where owner_id = ' || v_owner_literal || ' and due_date is null '
      'union all select id from public.financial_expenses where owner_id = ' || v_owner_literal || ' and expense_date is null) x', 'true'),
    public.backup_diagnostic_definition('invalid.required_dates', 'critical', 'x.id::text',
      '(select id from public.lead_followups where owner_id = ' || v_owner_literal || ' and due_at is null '
      'union all select id from public.financial_payments where owner_id = ' || v_owner_literal || ' and received_at is null '
      'union all select id from public.project_revisions where owner_id = ' || v_owner_literal || ' and requested_at is null) x', 'true'),
    public.backup_diagnostic_definition('invalid.client_activity_type', 'critical', 'a.id::text', 'public.client_activities a',
      format('a.owner_id = %s and (a.type is null or a.type not in ('
        '''conversion'',''contact'',''meeting'',''approval'',''status_change'',''delivery'',''financial'',''note''))', v_owner_literal)),
    public.backup_diagnostic_definition('invalid.text_lengths', 'critical', 'x.id::text',
      '(select id from public.expense_categories where owner_id = ' || v_owner_literal || ' and (name is null or length(name) not between 1 and 60 or pg_catalog.btrim(name) = '''') '
      'union all select id from public.revenue_categories where owner_id = ' || v_owner_literal || ' and (name is null or length(name) not between 1 and 60 or pg_catalog.btrim(name) = '''') '
      'union all select id from public.project_tasks where owner_id = ' || v_owner_literal || ' and category is not null and (length(category) not between 1 and 40 or pg_catalog.btrim(category) = '''') '
      'union all select id from public.project_revisions where owner_id = ' || v_owner_literal || ' and (description is null or pg_catalog.btrim(description) = '''') '
      'union all select id from public.financial_expenses where owner_id = ' || v_owner_literal || ' and (description is null or pg_catalog.btrim(description) = '''')) x', 'true'),
    public.backup_diagnostic_definition('invalid.event_timestamps', 'warning', 'x.id::text',
      '(select id from public.project_tasks where owner_id = ' || v_owner_literal || ' and ('
      '(status = ''completed'' and completed_at is null) or (status = ''cancelled'' and cancelled_at is null) or '
      '(status not in (''completed'',''cancelled'') and (completed_at is not null or cancelled_at is not null)) or '
      '(completed_at is not null and cancelled_at is not null)) '
      'union all select id from public.project_revisions where owner_id = ' || v_owner_literal || ' and ('
      '(status = ''approved'' and (completed_at is null or approved_at is null)) or '
      '(status = ''completed'' and (completed_at is null or approved_at is not null)) or '
      '(status in (''requested'',''in_progress'') and (completed_at is not null or approved_at is not null)) or '
      '(completed_at is not null and approved_at is not null and approved_at < completed_at)) '
      'union all select id from public.lead_followups where owner_id = ' || v_owner_literal || ' and ('
      '(status = ''concluido'' and completed_at is null) or (status <> ''concluido'' and completed_at is not null)) '
      'union all select id from public.lead_digital_checks where owner_id = ' || v_owner_literal || ' and ('
      'verified is null or (verified is true and verified_at is null) or (verified is false and verified_at is not null)) '
      'union all select id from public.financial_expenses where owner_id = ' || v_owner_literal || ' and ('
      '(status = ''paid'' and paid_at is null) or (status <> ''paid'' and paid_at is not null) or '
      '(status = ''cancelled'' and cancelled_at is null) or (status <> ''cancelled'' and cancelled_at is not null))) x', 'true'),
    public.backup_diagnostic_definition('invalid.created_by', 'critical', 'x.id::text',
      '(select id from public.lead_activities where owner_id = ' || v_owner_literal || ' and user_id is not null and user_id <> owner_id '
      'union all select id from public.client_activities where owner_id = ' || v_owner_literal || ' and created_by is not null and created_by <> owner_id '
      'union all select id from public.financial_payments where owner_id = ' || v_owner_literal || ' and created_by is not null and created_by <> owner_id) x', 'true')
  );

  for v_definition in select value from pg_catalog.jsonb_array_elements(v_definitions) as item(value) loop
    execute format(
      'select count(*)::bigint, coalesce((select jsonb_agg(sample_id) from ('
      'select distinct %s as sample_id from %s where %s order by sample_id limit 20'
      ') as sampled), ''[]''::jsonb) from (select distinct %s as sample_id from %s where %s) as all_rows',
      v_definition ->> 'key', v_definition ->> 'from', v_definition ->> 'where',
      v_definition ->> 'key', v_definition ->> 'from', v_definition ->> 'where'
    ) into v_count, v_samples;
    v_diagnostics := v_diagnostics || jsonb_build_array(jsonb_build_object(
      'code', v_definition ->> 'code', 'severity', v_definition ->> 'severity',
      'count', v_count, 'sample_ids', v_samples));
  end loop;

  select coalesce(jsonb_agg(value order by value ->> 'code'), '[]'::jsonb)
    into v_diagnostics from pg_catalog.jsonb_array_elements(v_diagnostics) as checks(value);
  return jsonb_build_object(
    'generated_at', now(), 'schema_version', 3, 'checks', v_diagnostics,
    'limits', jsonb_build_object('rows',50000,'zipBytes',26214400,'uncompressedBytes',52428800,
      'rpcBytes',4194304,'fieldBytes',1048576,'files',32,'columns',64)
  );
end;
$$;

revoke all on function public.preview_backup_restore(jsonb) from public, anon, authenticated;
revoke all on function public.restore_backup(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.get_backup_diagnostics() from public, anon, authenticated;
grant execute on function public.preview_backup_restore(jsonb) to authenticated;
grant execute on function public.restore_backup(jsonb,text,text) to authenticated;
grant execute on function public.get_backup_diagnostics() to authenticated;
```

- [ ] **Step 6: Preservar timestamps sem desativar triggers globalmente**

O GUC é `transaction local`; nenhuma trigger global é desabilitada. Redefina somente as funções abaixo, preservando seus corpos canônicos e acrescentando o guard de restore. Não edite nem redefina `public.audit_row_change()` nem `public.set_updated_at()`: a auditoria, seu guard e a versão hardenizada de `set_updated_at` pertencem exclusivamente a `0013_etapa3_security_audit.sql`. O preflight do restore impede executar antes dessa migration.

```sql
create or replace function public.enforce_lead_next_contact()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('ber.restore', true) = 'on' then return new; end if;
  new.next_contact_at := public.next_pending_followup(new.id);
  return new;
end;
$$;

create or replace function public.sync_followup_next_contact()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('ber.restore', true) = 'on' then return null; end if;
  if TG_OP = 'DELETE' then
    update public.leads
    set next_contact_at = public.next_pending_followup(old.lead_id)
    where id = old.lead_id;
  elsif TG_OP = 'INSERT' then
    update public.leads
    set next_contact_at = public.next_pending_followup(new.lead_id)
    where id = new.lead_id;
  elsif old.lead_id is distinct from new.lead_id then
    update public.leads
    set next_contact_at = public.next_pending_followup(old.lead_id)
    where id = old.lead_id;
    update public.leads
    set next_contact_at = public.next_pending_followup(new.lead_id)
    where id = new.lead_id;
  else
    update public.leads
    set next_contact_at = public.next_pending_followup(new.lead_id)
    where id = new.lead_id;
  end if;
  return null;
end;
$$;

create or replace function public.set_project_task_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('ber.restore', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.owner_id is distinct from new.owner_id then
      raise exception 'O proprietário da tarefa não pode ser alterado.' using errcode = '42501';
    end if;
    if old.project_id is distinct from new.project_id then
      raise exception 'A tarefa não pode ser movida para outro projeto.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      new.completed_at := now();
      new.cancelled_at := null;
    elsif new.status = 'cancelled' then
      new.cancelled_at := now();
      new.completed_at := null;
    else
      new.completed_at := null;
      new.cancelled_at := null;
    end if;
  elsif old.status is distinct from new.status then
    if new.status = 'completed' then
      new.completed_at := now();
      new.cancelled_at := null;
    elsif new.status = 'cancelled' then
      new.cancelled_at := now();
      new.completed_at := null;
    else
      new.completed_at := null;
      new.cancelled_at := null;
    end if;
  else
    new.completed_at := old.completed_at;
    new.cancelled_at := old.cancelled_at;
  end if;
  return new;
end;
$$;

create or replace function public.log_project_task_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_description text;
begin
  if current_setting('ber.restore', true) = 'on' then return new; end if;
  if tg_op = 'DELETE' then
    select * into v_project from public.projects where id = old.project_id and owner_id = old.owner_id;
    v_description := 'Tarefa excluída: ' || old.title || '.';
  elsif old.status is distinct from new.status and new.status in ('completed','cancelled') then
    select * into v_project from public.projects where id = new.project_id and owner_id = new.owner_id;
    v_description := case new.status
      when 'completed' then 'Tarefa concluída: ' || new.title || '.'
      else 'Tarefa cancelada: ' || new.title || '.'
    end;
  else
    return new;
  end if;

  insert into public.client_activities (
    owner_id, client_id, project_id, type, description, metadata
  ) values (
    v_project.owner_id, v_project.client_id, v_project.id,
    case when tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.status = 'cancelled') then 'note' else 'status_change' end,
    v_description,
    case when tg_op = 'DELETE' then jsonb_build_object('task_id', old.id) else jsonb_build_object('task_id', new.id) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.set_project_revision_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('ber.restore', true) = 'on' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.owner_id is distinct from new.owner_id then
      raise exception 'O proprietário da revisão não pode ser alterado.' using errcode = '42501';
    end if;
    if old.project_id is distinct from new.project_id then
      raise exception 'A revisão não pode ser movida para outro projeto.' using errcode = '42501';
    end if;
    if old.status = 'approved' then
      if new.status is distinct from old.status then
        raise exception 'Uma revisão aprovada não pode voltar para outro status.' using errcode = '23514';
      end if;
      if new.description is distinct from old.description
        or new.responsible_name is distinct from old.responsible_name
        or new.notes is distinct from old.notes
        or new.project_id is distinct from old.project_id
        or new.owner_id is distinct from old.owner_id then
        raise exception 'Uma revisão aprovada não pode ser alterada.' using errcode = '23514';
      end if;
    end if;
    if old.status is not distinct from new.status then
      new.completed_at := old.completed_at;
      new.approved_at := old.approved_at;
    elsif new.status = 'approved' then
      new.completed_at := case when old.status = 'completed' then old.completed_at else now() end;
      new.approved_at := now();
    elsif new.status = 'completed' then
      new.completed_at := now();
      new.approved_at := null;
    else
      new.completed_at := null;
      new.approved_at := null;
    end if;
  elsif new.status = 'approved' then
    new.completed_at := now();
    new.approved_at := now();
  elsif new.status = 'completed' then
    new.completed_at := now();
    new.approved_at := null;
  else
    new.completed_at := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.log_project_revision_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
  v_description text;
begin
  if current_setting('ber.restore', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status not in ('completed','approved') then
      return new;
    end if;
  elsif not (old.status is distinct from new.status and new.status in ('completed','approved')) then
    return new;
  end if;

  select * into v_project from public.projects where id = new.project_id and owner_id = new.owner_id;
  v_description := case new.status
    when 'completed' then 'Revisão concluída: ' || new.description || '.'
    else 'Revisão aprovada: ' || new.description || '.'
  end;
  insert into public.client_activities (
    owner_id, client_id, project_id, type, description, metadata
  ) values (
    v_project.owner_id, v_project.client_id, v_project.id,
    case when new.status = 'approved' then 'approval' else 'status_change' end,
    v_description, jsonb_build_object('revision_id', new.id)
  );
  return new;
end;
$$;

commit;
```

Não pule `enforce_contract_project_allocation` nem locks de mutação. O restore só insere linhas novas e a validação de alocação ocorre antes da escrita.

- [ ] **Step 7: GREEN, revisão e commit**

Em ambiente autorizado, aplique `0011`, `0012` e `0013` nesta ordem antes do GREEN. Se `0013` ainda não existir, o preflight do restore deve falhar e o resultado será registrado como dependência externa, nunca como teste aprovado.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0011_etapa3_settings.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0012_etapa3_backup.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0013_etapa3_security_audit.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_backup.sql
git diff --check
git add supabase/migrations/0012_etapa3_backup.sql supabase/tests/etapa3_backup.sql
git commit -m "feat: adicionar preview e restore transacional de backup"
```

Esperado: prévia não altera dados; CSV, hash e tabelas convergem; Maps inválido e conflitos abortam; idênticos são ignorados; a cadeia financeira é restaurada pela RPC dedicada; estorno e parcelas inválidos abortam; IDs e timestamps são preservados; outro dono não acessa; a auditoria final é obrigatória e reverte tudo se falhar. A prova estática da ordem dos locks não substitui um teste de concorrência com duas sessões; se esse teste não for executado, classifique a concorrência runtime como dependência externa.

### Task 10: Página de backup, prévia, confirmação e diagnóstico

**Files:**

- Create: `src/pages/BackupPage.tsx`
- Create: `src/pages/BackupPage.test.tsx`
- Modify: `src/routes/AppRoutes.tsx`
- Modify: `src/routes/AppRoutes.test.tsx`
- Modify: `src/layouts/AppLayout.tsx`
- Modify: `src/layouts/AppLayout.test.tsx`

**Interfaces consumed:** `BackupPackage`, `BackupDiagnostics`, `RestorePreview`, `createBackupPackage`, `emptyBackupTables`, `exportBackup`, `importBackupFile`, `previewRestore`, `restoreBackup`, `getDiagnostics`.

**Interfaces produced:** rota protegida `/backup`, página `BackupPage` e link `Backup` na navegação principal.

- [ ] **Step 1: Escrever os testes RED da página com pacote e diagnóstico reais**

O fixture do pacote deve passar pelo formatador canônico; não monte um objeto parcial com `manifest` e `tables` sem `csvText`. O hash de prévia deve ter 64 caracteres hexadecimais minúsculos, como o produzido pelo servidor.

```tsx
// @vitest-environment jsdom
// src/pages/BackupPage.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackupPackage, emptyBackupTables } from '../lib/backupFormat'
import type { BackupDiagnostics, BackupPackage, RestorePreview } from '../types/backup'

const OWNER = '00000000-0000-4000-8000-000000000201'
const OTHER_OWNER = '00000000-0000-4000-8000-000000000202'
const PACKAGE_HASH = 'a'.repeat(64)
const { authState, mocks } = vi.hoisted(() => ({
  authState: { userId: '00000000-0000-4000-8000-000000000201' as string | null },
  mocks: {
    exportBackup: vi.fn(), importBackupFile: vi.fn(), previewRestore: vi.fn(),
    restoreBackup: vi.fn(), getDiagnostics: vi.fn(),
  },
}))

vi.mock('../services/backupService', () => mocks)
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.userId ? { id: authState.userId } : null }),
}))

import { BackupPage } from './BackupPage'

const preview: RestorePreview = {
  previewId: PACKAGE_HASH,
  packageHash: PACKAGE_HASH,
  canRestore: true,
  totals: { new: 2, identical: 1, conflict: 0 },
  tables: [{ table: 'leads', new: 2, identical: 1, conflict: 0 }],
  issues: [],
}

const diagnostics: BackupDiagnostics = {
  generatedAt: '2026-11-27T12:00:00.000Z',
  schemaVersion: 3,
  checks: [
    { code: 'rls.disabled', severity: 'critical', count: 1, sampleIds: ['leads'] },
    { code: 'invalid.maps_url', severity: 'warning', count: 0, sampleIds: [] },
  ],
  limits: {
    rows: 50_000,
    zipBytes: 26_214_400,
    uncompressedBytes: 52_428_800,
    rpcBytes: 4_194_304,
    fieldBytes: 1_048_576,
    files: 32,
    columns: 64,
  },
}

let pkg: BackupPackage

function chooseFile() {
  const input = screen.getByLabelText('Arquivo ZIP de backup') as HTMLInputElement
  const file = new File(['zip'], 'backup.zip', { type: 'application/zip' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  fireEvent.change(input)
  return input
}

beforeEach(async () => {
  vi.clearAllMocks()
  authState.userId = OWNER
  pkg = await createBackupPackage(emptyBackupTables(), OWNER, '2026-11-27T12:00:00.000Z')
  mocks.exportBackup.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }))
  mocks.importBackupFile.mockResolvedValue(pkg)
  mocks.previewRestore.mockResolvedValue(preview)
  mocks.restoreBackup.mockResolvedValue({
    inserted: { leads: 2 },
    auditEventId: '00000000-0000-4000-8000-000000000501',
  })
  mocks.getDiagnostics.mockResolvedValue(diagnostics)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BackupPage', () => {
  it('exporta ZIP local e avisa que backup manual não substitui backup do banco', async () => {
    const createObjectURL = vi.fn(() => 'blob:backup')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<BackupPage />)

    expect(screen.getByText(/O backup manual não substitui o backup do banco/).textContent)
      .toContain('não substitui o backup do banco')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar backup ZIP' }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup')
    expect((await screen.findByRole('status')).textContent)
      .toContain('Backup ZIP gerado localmente')
  })

  it('exige confirmação explícita e restaura somente a prévia sem conflito', async () => {
    render(<BackupPage />)
    chooseFile()

    expect((await screen.findByText('2 nova(s), 1 idêntica(s), 0 conflito(s).')).textContent)
      .toBe('2 nova(s), 1 idêntica(s), 0 conflito(s).')
    const restoreButton = screen.getByRole('button', { name: 'Confirmar restore' }) as HTMLButtonElement
    expect(restoreButton.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que a prévia não contém conflitos/ }))
    expect(restoreButton.disabled).toBe(false)
    fireEvent.click(restoreButton)

    await waitFor(() => expect(mocks.restoreBackup).toHaveBeenCalledWith(pkg, PACKAGE_HASH))
    expect((await screen.findByRole('status')).textContent).toContain('2 linha(s) inserida(s)')
    await waitFor(() => expect(mocks.getDiagnostics).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('2 nova(s), 1 idêntica(s), 0 conflito(s).')).toBeNull()
  })

  it('bloqueia restore quando a prévia contém conflito', async () => {
    mocks.previewRestore.mockResolvedValue({
      ...preview,
      canRestore: false,
      totals: { new: 0, identical: 0, conflict: 1 },
      issues: ['Conflito de ID em leads.'],
    })
    render(<BackupPage />)
    chooseFile()

    expect((await screen.findByText('Conflito de ID em leads.')).textContent)
      .toBe('Conflito de ID em leads.')
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que a prévia não contém conflitos/ }))
    expect((screen.getByRole('button', { name: 'Confirmar restore' }) as HTMLButtonElement).disabled)
      .toBe(true)
    expect(mocks.restoreBackup).not.toHaveBeenCalled()
  })

  it('exibe todos os checks e os sete limites do diagnóstico read-only', async () => {
    render(<BackupPage />)

    expect((await screen.findByText(/2026-11-27T12:00:00\.000Z/)).textContent)
      .toContain(diagnostics.generatedAt)
    expect(screen.getByText(/^rls\.disabled/).textContent).toContain('critical')
    expect(screen.getByText(/^invalid\.maps_url/).textContent).toContain('warning')
    expect(screen.getByText('Amostras: leads').textContent).toBe('Amostras: leads')
    expect(screen.getByText('Linhas: 50000').textContent).toBe('Linhas: 50000')
    expect(screen.getByText('ZIP: 26214400').textContent).toBe('ZIP: 26214400')
    expect(screen.getByText('Descompactado: 52428800').textContent).toBe('Descompactado: 52428800')
    expect(screen.getByText('RPC: 4194304').textContent).toBe('RPC: 4194304')
    expect(screen.getByText('Campo: 1048576').textContent).toBe('Campo: 1048576')
    expect(screen.getByText('Arquivos: 32').textContent).toBe('Arquivos: 32')
    expect(screen.getByText('Colunas: 64').textContent).toBe('Colunas: 64')
  })

  it('mostra erro de importação sem consultar a prévia', async () => {
    mocks.importBackupFile.mockRejectedValue(new Error('Hash do arquivo não confere.'))
    render(<BackupPage />)
    chooseFile()

    expect((await screen.findByRole('alert')).textContent).toBe('Hash do arquivo não confere.')
    expect(mocks.previewRestore).not.toHaveBeenCalled()
    expect(mocks.restoreBackup).not.toHaveBeenCalled()
  })

  it('permite tentar novamente quando o diagnóstico falha', async () => {
    mocks.getDiagnostics.mockRejectedValueOnce(new Error('Diagnóstico indisponível.'))
    render(<BackupPage />)

    expect((await screen.findByRole('alert')).textContent).toBe('Diagnóstico indisponível.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar diagnóstico novamente' }))
    expect((await screen.findByText(/2026-11-27T12:00:00\.000Z/)).textContent)
      .toContain(diagnostics.generatedAt)
    expect(mocks.getDiagnostics).toHaveBeenCalledTimes(2)
  })

  it('ignora diagnóstico antigo depois de trocar o usuário autenticado', async () => {
    let resolveFirst!: (value: BackupDiagnostics) => void
    const stale = {
      ...diagnostics,
      checks: [{ code: 'stale.check', severity: 'critical', count: 1, sampleIds: ['stale'] }],
    } satisfies BackupDiagnostics
    mocks.getDiagnostics
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(diagnostics)
    const view = render(<BackupPage />)

    authState.userId = OTHER_OWNER
    view.rerender(<BackupPage />)
    await act(async () => { resolveFirst(stale) })
    await act(async () => { await Promise.resolve() })

    expect(screen.queryByText(/^stale\.check/)).toBeNull()
    expect((await screen.findByText(/2026-11-27T12:00:00\.000Z/)).textContent)
      .toContain(diagnostics.generatedAt)
  })

  it('ignora importação e prévia antigas depois de trocar o usuário autenticado', async () => {
    let resolveImport!: (value: BackupPackage) => void
    mocks.importBackupFile.mockReturnValueOnce(new Promise((resolve) => { resolveImport = resolve }))
    const view = render(<BackupPage />)
    const input = chooseFile()

    authState.userId = OTHER_OWNER
    view.rerender(<BackupPage />)
    await act(async () => { resolveImport(pkg) })
    await act(async () => { await Promise.resolve() })

    expect(mocks.previewRestore).not.toHaveBeenCalled()
    expect(screen.queryByText(/nova\(s\), .* idêntica\(s\)/)).toBeNull()
    await waitFor(() => expect(input.disabled).toBe(false))
  })

  it('mantém a prévia e permite nova confirmação quando o restore falha', async () => {
    mocks.restoreBackup.mockRejectedValue(new Error('A auditoria final falhou; nada foi inserido.'))
    render(<BackupPage />)
    chooseFile()
    await screen.findByText('2 nova(s), 1 idêntica(s), 0 conflito(s).')
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que a prévia não contém conflitos/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar restore' }))

    expect((await screen.findByRole('alert')).textContent)
      .toBe('A auditoria final falhou; nada foi inserido.')
    expect(screen.getByText('2 nova(s), 1 idêntica(s), 0 conflito(s).')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Confirmo que a prévia não contém conflitos/ }) as HTMLInputElement).checked)
      .toBe(false)
  })
})
```

Comando RED:

```bash
npm test -- src/pages/BackupPage.test.tsx src/routes/AppRoutes.test.tsx
```

Esperado: `BackupPage.tsx` e `/backup` ainda não existem. Se o fixture falhar antes da ausência da página, corrija somente o fixture para usar o contrato da Task 7; não enfraqueça as asserções.

- [ ] **Step 2: Criar a página com proteção de montagem, sessão e concorrência**

```tsx
// src/pages/BackupPage.tsx
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../components/ui/Button'
import {
  exportBackup, getDiagnostics, importBackupFile, previewRestore, restoreBackup,
} from '../services/backupService'
import { useAuth } from '../hooks/useAuth'
import type { BackupDiagnostics, BackupPackage, RestorePreview } from '../types/backup'

const LIMIT_LABELS: Array<[keyof BackupDiagnostics['limits'], string]> = [
  ['rows', 'Linhas'],
  ['zipBytes', 'ZIP'],
  ['uncompressedBytes', 'Descompactado'],
  ['rpcBytes', 'RPC'],
  ['fieldBytes', 'Campo'],
  ['files', 'Arquivos'],
  ['columns', 'Colunas'],
]

function sumInserted(inserted: Record<string, number>): number {
  return Object.values(inserted).reduce((total, value) => total + value, 0)
}

export function BackupPage() {
  const { user } = useAuth()
  const [diagnostics, setDiagnostics] = useState<BackupDiagnostics | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState('')
  const [pkg, setPkg] = useState<BackupPackage | null>(null)
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const mountedRef = useRef(false)
  const activeRef = useRef(false)
  const requestRef = useRef(0)
  const diagnosticRequestRef = useRef(0)
  const sessionRef = useRef<string | null>(null)
  const busyRef = useRef(false)

  const refreshDiagnostics = useCallback(async () => {
    const owner = sessionRef.current
    if (!owner) return
    const current = ++diagnosticRequestRef.current
    const isCurrent = () => mountedRef.current && activeRef.current
      && sessionRef.current === owner && diagnosticRequestRef.current === current
    setDiagnosticsLoading(true)
    setDiagnosticsError('')
    try {
      const result = await getDiagnostics()
      if (isCurrent()) setDiagnostics(result)
    } catch (cause) {
      if (isCurrent()) {
        setDiagnosticsError(cause instanceof Error ? cause.message : 'Não foi possível carregar o diagnóstico.')
      }
    } finally {
      if (isCurrent()) setDiagnosticsLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    activeRef.current = true
    sessionRef.current = user?.id ?? null
    requestRef.current += 1
    diagnosticRequestRef.current += 1
    busyRef.current = false
    setBusy(false)
    setDiagnostics(null)
    setDiagnosticsError('')
    setPkg(null)
    setPreview(null)
    setConfirmed(false)
    setError('')
    setMessage('')
    if (user?.id) void refreshDiagnostics()
    return () => {
      mountedRef.current = false
      activeRef.current = false
      requestRef.current += 1
      diagnosticRequestRef.current += 1
    }
  }, [user?.id, refreshDiagnostics])

  function operationIsCurrent(current: number, owner: string): boolean {
    return mountedRef.current && activeRef.current
      && sessionRef.current === owner && requestRef.current === current
  }

  async function download() {
    const owner = sessionRef.current
    if (!owner || busyRef.current) return
    const current = ++requestRef.current
    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const blob = await exportBackup()
      if (!operationIsCurrent(current, owner)) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ber-crm-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      document.body.appendChild(anchor)
      try {
        anchor.click()
      } finally {
        anchor.remove()
        URL.revokeObjectURL(url)
      }
      setMessage('Backup ZIP gerado localmente. Guarde o arquivo em local seguro.')
    } catch (cause) {
      if (operationIsCurrent(current, owner)) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível exportar o backup.')
      }
    } finally {
      if (operationIsCurrent(current, owner)) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    const owner = sessionRef.current
    if (!file || !owner || busyRef.current) return
    const current = ++requestRef.current
    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')
    setPkg(null)
    setPreview(null)
    setConfirmed(false)
    try {
      const imported = await importBackupFile(file)
      if (!operationIsCurrent(current, owner)) return
      const result = await previewRestore(imported)
      if (!operationIsCurrent(current, owner)) return
      setPkg(imported)
      setPreview(result)
    } catch (cause) {
      if (operationIsCurrent(current, owner)) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível ler a prévia do backup.')
      }
    } finally {
      input.value = ''
      if (operationIsCurrent(current, owner)) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  async function confirmRestore() {
    const owner = sessionRef.current
    if (!owner || !pkg || !preview?.canRestore || !confirmed || busyRef.current) return
    const current = ++requestRef.current
    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await restoreBackup(pkg, preview.packageHash)
      if (!operationIsCurrent(current, owner)) return
      setMessage(`${sumInserted(result.inserted)} linha(s) inserida(s). Conflitos não foram sobrescritos. Auditoria: ${result.auditEventId}.`)
      setPreview(null)
      setPkg(null)
      setConfirmed(false)
      await refreshDiagnostics()
    } catch (cause) {
      if (operationIsCurrent(current, owner)) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível restaurar o backup.')
        setConfirmed(false)
      }
    } finally {
      if (operationIsCurrent(current, owner)) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Backup e restauração</h1>
        <p className="mt-1 text-sm text-muted">Arquivos ZIP locais, com manifesto e SHA-256. Nenhuma credencial é incluída.</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-sm font-semibold text-ink">Exportar</h2>
        <p className="text-sm text-muted">O backup manual não substitui o backup do banco. Planos gratuitos têm limites de retenção e tamanho.</p>
        <Button type="button" loading={busy} onClick={() => void download()}>Exportar backup ZIP</Button>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-sm font-semibold text-ink">Restaurar</h2>
        <label className="block text-sm font-medium text-ink" htmlFor="backup-file">Arquivo ZIP de backup</label>
        <input
          id="backup-file"
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(event) => void selectFile(event)}
        />
        <p className="text-sm text-muted">A prévia não grava dados. Linhas novas são inseridas; idênticas são ignoradas; qualquer conflito aborta.</p>
        {preview && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-ink">
              {preview.totals.new} nova(s), {preview.totals.identical} idêntica(s), {preview.totals.conflict} conflito(s).
            </p>
            {preview.tables.length > 0 && (
              <ul className="space-y-1 text-sm text-muted">
                {preview.tables.map((row) => (
                  <li key={row.table}>{row.table}: {row.new} nova(s), {row.identical} idêntica(s), {row.conflict} conflito(s)</li>
                ))}
              </ul>
            )}
            {preview.issues.map((issue, index) => (
              <p key={`${issue}-${index}`} className="text-sm text-danger">{issue}</p>
            ))}
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy || !preview.canRestore}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Confirmo que a prévia não contém conflitos e que somente linhas novas serão inseridas.
            </label>
            <Button
              type="button"
              loading={busy}
              disabled={!preview.canRestore || !confirmed}
              onClick={() => void confirmRestore()}
            >
              Confirmar restore
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-ink">Diagnóstico read-only</h2>
          <Button type="button" variant="outline" disabled={busy || diagnosticsLoading} onClick={() => void refreshDiagnostics()}>
            Atualizar diagnóstico
          </Button>
        </div>
        {diagnosticsError && <p role="alert" className="text-sm text-danger">{diagnosticsError}</p>}
        {diagnosticsError && !diagnostics && (
          <Button type="button" variant="outline" onClick={() => void refreshDiagnostics()}>
            Tentar diagnóstico novamente
          </Button>
        )}
        {diagnosticsLoading && !diagnostics && <p className="text-sm text-muted">Carregando diagnóstico...</p>}
        {diagnostics && (
          <>
            <p className="text-sm text-muted">Gerado em {diagnostics.generatedAt}. Versão do schema: {diagnostics.schemaVersion}.</p>
            <ul className="space-y-2">
              {diagnostics.checks.map((check) => (
                <li key={check.code} className="rounded-xl border border-line bg-elevated p-3 text-sm">
                  <p className="font-medium text-ink">{check.code} — {check.severity} — {check.count} ocorrência(s)</p>
                  {check.sampleIds.length > 0 && <p className="mt-1 break-all text-xs text-muted">Amostras: {check.sampleIds.join(', ')}</p>}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
              {LIMIT_LABELS.map(([key, label]) => (
                <p key={key}>{label}: {diagnostics.limits[key]}</p>
              ))}
            </div>
          </>
        )}
      </section>

      {message && <p role="status" className="text-sm text-success">{message}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
```

Os refs têm responsabilidades distintas: `mountedRef` e `activeRef` bloqueiam atualização após desmontagem/troca de efeito; `requestRef` invalida exportação, importação e restore; `diagnosticRequestRef` invalida somente diagnósticos; `sessionRef` impede reutilização entre owners; `busyRef` fecha a janela síncrona antes de `setBusy` causar render. Não substitua esses guards por `if (!mounted)` no final nem remova a confirmação checkbox.

- [ ] **Step 3: Adicionar o mock de BackupPage no topo do teste de rotas**

Em `src/routes/AppRoutes.test.tsx`, junto dos demais mocks de página e antes de qualquer `it`, acrescente:

```tsx
vi.mock('../pages/BackupPage', () => ({ BackupPage: () => <h1>Backup</h1> }))
```

Depois do teste parametrizado de rotas protegidas, acrescente:

```tsx
it('renderiza /backup pela rota lazy autenticada', async () => {
  renderPath('/backup')

  expect(screen.getByText('Rota protegida')).toBeTruthy()
  expect(screen.getByText('Layout do aplicativo')).toBeTruthy()
  expect((await screen.findByRole('heading', { name: 'Backup' })).textContent).toBe('Backup')
})
```

O teste é assíncrono porque o módulo lazy ainda não foi resolvido. Não use `vi.mock` dentro de `it` e não altere `/relatorios`.

- [ ] **Step 4: Criar a rota lazy autenticada**

Em `src/routes/AppRoutes.tsx`, altere a importação do React Router e acrescente a constante após os imports:

```tsx
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
```

```tsx
const BackupPage = lazy(() => import('../pages/BackupPage').then((module) => ({ default: module.BackupPage })))
```

Dentro de `<AppLayout>`, ao lado de `/configuracoes`, acrescente:

```tsx
<Route
  path="/backup"
  element={(
    <Suspense fallback={<p className="p-6 text-sm text-muted">Carregando backup...</p>}>
      <BackupPage />
    </Suspense>
  )}
/>
```

A exportação de `BackupPage` é nomeada; por isso o `lazy` precisa converter `module.BackupPage` em `default`.

- [ ] **Step 5: Adicionar o link de navegação e atualizar seu teste**

Em `src/layouts/AppLayout.tsx`, inclua `HardDriveDownload` na importação de `lucide-react` e acrescente o item ao final de `navItems`:

```tsx
{ label: 'Backup', icon: HardDriveDownload, to: '/backup' },
```

Em `src/layouts/AppLayout.test.tsx`, atualize o teste `exibe os nove links navegáveis na ordem e mantém Follow-ups apenas no sino` para dez links, renomeando-o e incluindo `Backup` ao final das duas listas esperadas:

```tsx
it('exibe os dez links navegáveis na ordem e mantém Follow-ups apenas no sino', async () => {
  renderLayout()
  await waitFor(() => expect(countOverdue).toHaveBeenCalled())

  const nav = screen.getByRole('navigation')
  const links = within(nav).getAllByRole('link')
  expect(links.map((link) => link.textContent)).toEqual([
    'Dashboard', 'Leads', 'Oportunidades', 'Pipeline', 'Clientes', 'Projetos',
    'Financeiro', 'Relatórios', 'Configurações', 'Backup',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/', '/leads', '/oportunidades', '/pipeline', '/clientes', '/projetos',
    '/financeiro', '/relatorios', '/configuracoes', '/backup',
  ])
  expect(within(nav).queryByRole('link', { name: 'Follow-ups' })).toBeNull()
  expect(screen.getByText('Etapa 3 — clientes, projetos e financeiro.')).toBeTruthy()
})
```

Não crie o link antes de `BackupPage.tsx` existir.

- [ ] **Step 6: GREEN, revisão e commit**

```bash
npm test -- src/pages/BackupPage.test.tsx src/routes/AppRoutes.test.tsx src/layouts/AppLayout.test.tsx
npm test -- src/services/backupService.test.ts src/lib/backupFormat.test.ts
git diff --check
git add src/pages/BackupPage.tsx src/pages/BackupPage.test.tsx src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx src/layouts/AppLayout.tsx src/layouts/AppLayout.test.tsx
git commit -m "feat: entregar jornada local de backup e restore"
```

Esperado: exportação local; importação inválida bloqueada; diagnóstico com `checks` e sete limites; prévia conflitante bloqueia restore; confirmação explícita necessária; sucesso mostra o ID de auditoria; falha preserva a prévia e exige nova confirmação; respostas antigas não aparecem após troca de usuário; `/backup` é protegida e lazy; o link aparece na ordem definida. O build completo pertence ao gate final da Task 12.

---

### Task 11: Documentar operação, limites e manutenção de settings e backup

**Files:**

- Create: `docs/backup-restore.md`
- Test: validação estática inline do documento; não criar script de produção.

**Interfaces consumed:** contratos e limites das Tasks 2–10; ordem de migrations `0011` → `0012` → `0013`.

**Interfaces produced:** `docs/backup-restore.md`, operação específica deste plano. `README.md`, `docs/supabase-schema.md`, `docs/vercel-deploy.md`, CI e relatório integrado permanecem ownership da Task 10/11 do plano `docs/superpowers/plans/2026-11-26-etapa3-seguranca-finalizacao.md`.

- [ ] **Step 1: Capturar RED da documentação ausente**

```bash
node --input-type=module -e "import fs from 'node:fs'; const p='docs/backup-restore.md'; if (!fs.existsSync(p)) { console.error('RED: docs/backup-restore.md ausente'); process.exit(1); } const text=fs.readFileSync(p,'utf8'); const required=['0011_etapa3_settings.sql','0012_etapa3_backup.sql','0013_etapa3_security_audit.sql','50.000','25 MiB','50 MiB','4 MiB','security definer','write_audit_event','backup manual','Configuração externa']; const missing=required.filter((token)=>!text.includes(token)); if (missing.length) { console.error('RED: conteúdo obrigatório ausente:',missing.join(', ')); process.exit(1); }"
```

Esperado: exit 1 porque o arquivo ainda não existe. Não crie um README paralelo nem altere a documentação que pertence ao plano de Segurança.

- [ ] **Step 2: Criar o documento operacional específico**

````markdown
# Configurações, backup e restauração — Ber CRM Free

## Escopo e limites

Este documento descreve as configurações do proprietário, a exportação ZIP local, a prévia de restauração, o restore transacional e o diagnóstico read-only. O CRM não envia mensagens automaticamente, não publica arquivos em terceiros e não inclui senhas, tokens, chaves ou credenciais no pacote.

O backup manual não substitui o backup do banco. O Supabase Free e a Vercel Hobby têm limites de retenção, armazenamento, tráfego e execução; não há promessa de backup automático, disponibilidade ou armazenamento ilimitados neste plano.

## Pré-requisitos e migrations

Use Node.js 24 e as dependências do lockfile. Configure somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública anon/publishable em `.env.local`. Nunca use service role key no frontend, em CI público, em documentação ou neste pacote.

Aplique as migrations existentes em ordem. Quando Relatórios estiver instalado, a sequência é `0001`–`0010`, depois `0011_etapa3_settings.sql`, `0012_etapa3_backup.sql` e `0013_etapa3_security_audit.sql`. Sem Relatórios, a sequência deste plano é `0011` → `0012` → `0013` após a base já aplicada. Não edite migrations históricas para instalar este módulo.

`0013` é o único dono de `audit_events`, `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid` e dos triggers genéricos de auditoria. `0012` pode ser aplicado antes de `0013`, mas nenhum restore ou auditoria deve ser executado ou classificado como testado antes de `0013`.

## Configurações

- Nome de exibição fica em `profiles`; e-mail e senha pertencem ao Supabase Auth.
- `user_settings.service_prices` continua sendo a fonte de valores de referência usados pelos formulários. Valor estimado não é faturamento nem dinheiro recebido.
- `whatsapp_template` é apenas um template editável. O envio continua manual e exige revisão do usuário.
- `preferences` é versionado e validado no cliente e no banco. Rótulos, ordem e padrão comercial usam somente os códigos canônicos de leads.
- Nichos atendidos usam a lista canônica; serviços, métodos de pagamento, notas comerciais, categorias de projetos, prioridades e preferências de interface não criam novos códigos de status.
- Salvar settings atualiza o provedor de preferências sem exigir recarga da página.
- Recalcular prioridades de oportunidades exige prévia e confirmação. Settings não recalcula nem altera registros antigos silenciosamente.
- Categorias de receita e vínculo opcional em pagamentos são aditivos; categorias de despesas pertencem ao módulo financeiro.
- A categoria textual de tarefa é opcional; string vazia normaliza para `null`.

## Exportação local

A rota protegida `/backup` gera um ZIP no navegador. O ZIP contém `manifest.json` e os CSVs canônicos das 18 tabelas do registry: leads, atividades de lead, follow-ups, verificações digitais, clientes, vínculos lead–cliente, contratos, projetos, atividades de cliente, tarefas, revisões, parcelas, categorias de despesa, categorias de receita, pagamentos, alocações de pagamento, despesas e `user_settings`.

O manifesto registra formato, versão, data, owner, contagens, nomes de arquivos, colunas e SHA-256. Os CSVs usam UTF-8 com BOM, separador `;`, cabeçalhos em português, todos os campos entre aspas, escape `""` e newline final. Células com primeiro caractere significativo perigoso recebem apóstrofo de proteção contra fórmula.

O servidor regenera o CSV canônico e recalcula cada SHA-256 durante a importação. O hash informado pelo cliente é apenas comparação; o manifesto não é autoridade. `profiles` e `auth.users` não são exportados.

### Limites independentes

| Limite | Valor |
| --- | --- |
| ZIP local | 25 MiB (26.214.400 bytes) |
| Conteúdo descompactado | 50 MiB (52.428.800 bytes) |
| Payload da RPC | 4 MiB (4.194.304 bytes) |
| Campo textual | 1 MiB (1.048.576 bytes) |
| Arquivos no ZIP | 32 |
| Linhas totais | 50.000 |
| Colunas por tabela | 64 |

O ZIP permite somente `manifest.json` e os 18 CSVs allowlisted. O limite de 4 MiB não substitui o limite do ZIP nem o total descompactado.

## Prévia e restauração

1. Faça login como proprietário e abra `/backup`.
2. Selecione o ZIP. A importação valida formato, dono, limites, colunas, hashes, conteúdo canônico e coerência do pacote antes de qualquer escrita.
3. Leia o resumo de linhas novas, idênticas e conflitantes, incluindo problemas por tabela.
4. Confirme explicitamente somente quando não houver conflito.
5. O RPC `restore_backup(jsonb,text,text)` adquire os locks canônicos, revalida a classificação e executa o pacote inteiro ou nada.
6. O resultado informa as inserções por tabela e o ID do evento de auditoria.

O comportamento padrão nunca sobrescreve: linhas novas são inseridas, linhas idênticas são ignoradas e qualquer conflito aborta. IDs são preservados apenas sem colisão. Relações, valores, datas, status, duplicidades canônicas, saldos, parcelas, alocações e estornos são validados antes da escrita.

O restore financeiro usa uma RPC dedicada na mesma transação, sem grants de INSERT direto. A ordem de locks é: chaves de pagamento ordenadas, clientes, contratos, lock global de restore, filas de tarefas por owner e linhas existentes por ID; as leads afetadas também são bloqueadas por ID antes da escrita para competir na mesma ordem que as RPCs de follow-up. A auditoria final é obrigatória; se ela falhar, toda a operação principal reverte.

Durante `ber.restore = 'on'`, os triggers preservam os timestamps do pacote e a auditoria genérica não duplica o evento explícito de restore. Confirmação textual, hash de prévia e dono autenticado são todos necessários; nenhum deles substitui os demais.

## Diagnóstico read-only

O diagnóstico usa RPC `security definer`, `search_path = ''` e consultas `stable`, com filtro explícito por `auth.uid()` em todas as leituras de dados. Ele não depende das policies que ocultariam filhos órfãos e nunca corrige ou exclui dados. Os checks têm `code`, `severity`, `count` e até 20 IDs de amostra. Categorias cobertas:

- RLS desativada e owners incompatíveis;
- órfãos e relações lead–cliente, cliente–contrato–projeto, tarefa–projeto, revisão–projeto e finanças;
- duplicidades de telefone/WhatsApp, CNPJ, chaves de criação, vínculos, categorias e verificações;
- preferências, preços, template, URLs Maps, comprimentos e campos obrigatórios;
- valores, datas, status e timestamps inválidos;
- saldos, parcelas, pagamentos, alocações, estornos e despesas divergentes;
- próxima data de contato divergente do menor follow-up pendente.

Uma contagem zero não substitui evidência runtime de dois usuários autenticados. Correção destrutiva exibe procedimento separado, backup e confirmação; não há correção automática pelo diagnóstico.

## Segurança e auditoria

Toda leitura e escrita é limitada ao `owner_id = auth.uid()`. RPCs de leitura usam `security invoker`; o diagnóstico read-only é a exceção `security definer` para enxergar órfãos ocultos por policies, com `search_path = ''`, consultas `stable` e filtro explícito pelo owner. RPCs sensíveis usam `security definer`, `search_path = ''`, objetos qualificados e grants mínimos. A validação do cliente é conveniência; RLS e as RPCs são a autoridade final.

A auditoria é append-only e registra usuário, tipo, IDs, data e apenas metadados mínimos allowlisted. Nunca grave payload bruto, URL, e-mail, senha, token ou chave. A falha de auditoria obrigatória reverte a operação principal.

## Verificação e manutenção

```bash
npm ci
npm test -- --maxWorkers=2
npm run build
npm run lint
git diff --check
```

O harness SQL deve abrir transação, assumir `authenticated`, configurar `request.jwt.claim.sub`, usar usuários sintéticos criados na transação e terminar com `rollback;`. Executar SQL local ou remoto requer ambiente autorizado e não deve expor credenciais em logs, CI público ou relatórios.

## Classificação de pendências externas

Migrações remotas, persistência autenticada, isolamento RLS real entre dois proprietários, concorrência com duas sessões, restore com dados reais, smoke browser autenticado e publicação na Vercel são **Configuração externa** quando não houver evidência fresca do comando/data/resultado. Testes mockados e fixtures sintéticas não comprovam esses itens. O projeto só pode ser declarado finalizado sem Critical/Important aberto de segurança, persistência ou integridade financeira.
````

O documento deve usar a grafia “Configuração externa” na classificação e deixar claro que backup é manual. Não inclua valores de credenciais, IDs reais de usuários ou dados de prospecção.

- [ ] **Step 3: Validar GREEN, conteúdo e ausência de segredos**

```bash
node --input-type=module -e "import fs from 'node:fs'; const p='docs/backup-restore.md'; const text=fs.readFileSync(p,'utf8'); const required=['0011_etapa3_settings.sql','0012_etapa3_backup.sql','0013_etapa3_security_audit.sql','50.000','25 MiB','50 MiB','4 MiB','security definer','write_audit_event','backup manual','Configuração externa']; const missing=required.filter((token)=>!text.includes(token)); const placeholders=text.match(/\b(TODO|TBD|CONTINUA)\b|implement later/gi) ?? []; if (missing.length || placeholders.length) { console.error({missing,placeholders}); process.exit(1); } console.log('documento operacional conferido');"
git grep -nE 'service_role|SERVICE_ROLE|sb_secret_|sk_live_|PRIVATE KEY' -- docs/backup-restore.md .env.example
git diff --check
```

Esperado: scanner encontra todos os tokens e nenhum placeholder; a busca de segredos não retorna correspondências reais. Uma correspondência exige inspeção humana antes de continuar.

- [ ] **Step 4: Commit da documentação específica**

```bash
git status --short
git add docs/backup-restore.md
git commit -m "docs: documentar settings backup e restore"
git status --short
```

Esperado: somente `docs/backup-restore.md` entra neste commit. A Task 10 do plano de Segurança continuará responsável por atualizar `README.md` e `docs/supabase-schema.md` com link para este documento.

---

### Task 12: Gate final e relatório de aceite classificado deste plano

**Files:**

- Create: `.superpowers/sdd/2026-11-26-etapa3-configuracoes-backup/acceptance-report.md`
- Modify: nenhum arquivo de produção esperado; defeitos encontrados exigem task corretiva separada antes do aceite.

**Interfaces consumed:** todos os artefatos das Tasks 1–11; gates CI/documentação do plano `docs/superpowers/plans/2026-11-26-etapa3-seguranca-finalizacao.md`.

**Interfaces produced:** relatório de aceite escopado, sem substituir o relatório integrado da Etapa 3.

- [ ] **Step 1: Conferir dependências antes de executar os gates**

```bash
test -f supabase/migrations/0011_etapa3_settings.sql
test -f supabase/migrations/0012_etapa3_backup.sql
test -f supabase/migrations/0013_etapa3_security_audit.sql
test -f supabase/tests/etapa3_backup.sql
test -f src/types/backup.ts
test -f src/lib/backupFormat.ts
test -f src/services/backupService.ts
test -f src/pages/BackupPage.tsx
test -f docs/backup-restore.md
test -f README.md
test -f docs/supabase-schema.md
```

Esperado: todos os arquivos existem. Se `0013`, `README.md` ou `docs/supabase-schema.md` ainda não existir, pare e classifique o gate como dependência externa; não crie objetos pertencentes a outro plano.

- [ ] **Step 2: Executar o gate completo com evidência fresca**

```bash
npm test -- --maxWorkers=2
npm run build
npm run lint
git diff --check
```

Registre comando, data, saída resumada e escopo para cada gate. Nenhum comando pode ser declarado aprovado sem exit 0 e inspeção do resultado. Se `0013` não estiver aplicada no ambiente SQL, os testes de restore/auditoria permanecem dependentes de configuração externa, mesmo que o harness SQL local tenha passado.

- [ ] **Step 3: Revisar documentação, placeholders e segredos no escopo implementado**

```bash
node --input-type=module -e "import fs from 'node:fs'; const files=['docs/backup-restore.md','README.md','docs/supabase-schema.md','docs/vercel-deploy.md','.env.example']; const required=['0011_etapa3_settings.sql','0012_etapa3_backup.sql','0013_etapa3_security_audit.sql']; let failed=false; for (const file of files) { if (!fs.existsSync(file)) { console.error('arquivo ausente:',file); failed=true; continue; } const text=fs.readFileSync(file,'utf8'); const placeholders=text.match(/\b(TODO|TBD|CONTINUA)\b|implement later/gi) ?? []; if (placeholders.length) { console.error('placeholders:',file,placeholders); failed=true; } } const schema=fs.readFileSync('docs/supabase-schema.md','utf8'); const missing=required.filter((token)=>!schema.includes(token)); if (missing.length) { console.error('ordem ausente no schema:',missing); failed=true; } if (!fs.readFileSync('README.md','utf8').includes('docs/backup-restore.md')) { console.error('README sem link para docs/backup-restore.md'); failed=true; } if (failed) process.exit(1); console.log('documentação e placeholders conferidos');"
git grep -nE 'service_role|SERVICE_ROLE|sb_secret_|sk_live_|PRIVATE KEY' -- docs/backup-restore.md README.md docs/supabase-schema.md docs/vercel-deploy.md .env.example
git status --short
```

Esperado: nenhum placeholder real, ordem `0011`–`0012`–`0013` no schema, link do README para o documento específico e nenhuma credencial. A busca de segredos é apenas scanner; qualquer correspondência exige leitura manual e bloqueia o aceite até ser descartada ou removida.

- [ ] **Step 4: Consolidar evidência de browser e runtime sem inventar aprovação**

Use a rota `/backup` em navegador local autenticado e verifique: carregamento do diagnóstico; exportação do ZIP; reimportação do próprio ZIP; prévia idêntica sem escrita; conflito bloqueando confirmação; layout em desktop e mobile; console sem erros. Registre data, URL local, usuário sintético/autorizado e resultado.

Para restore real, RLS entre dois owners e concorrência, consuma somente evidência fresca da Task 6 e da jornada integrada do plano de Segurança. Se a evidência não existir, classifique cada item como **Configuração externa**; não converta teste mockado ou fixture SQL em prova runtime. Não aplique migration remota, não faça push/deploy e não use dados reais de prospecção no teste.

- [ ] **Step 5: Escrever o relatório de aceite escopado**

Escreva `.superpowers/sdd/2026-11-26-etapa3-configuracoes-backup/acceptance-report.md` com:

1. Identificação do plano, commit base, commit final e data da execução.
2. Matriz de Tasks 1–12 com arquivos produzidos, commit e verificação executada.
3. Matriz dos gates `npm test -- --maxWorkers=2`, `npm run build`, `npm run lint`, `git diff --check`, scanner documental e browser, contendo comando/data/resultado/escopo reais.
4. Classificação individual de settings, exportação, importação, prévia, restore, diagnóstico, RLS, auditoria, responsividade e publicação usando exclusivamente: **concluída/testada**, **implementada/não testada**, **pendente** ou **Configuração externa**.
5. Lista de Critical/Important abertos e decisão explícita de bloqueio. Qualquer falha de segurança, persistência ou integridade financeira impede declarar a Etapa 3 finalizada.
6. Limitações de free tier, ausência de backup automático e dependências externas remanescentes.

O relatório é artefato local de trabalho e não deve conter credenciais, dados de leads ou alegações sem evidência.

- [ ] **Step 6: Encerrar sem commit vazio e devolver o estado real**

```bash
git status --short
git diff --check
```

Se os gates não alterarem arquivos rastreados, não crie commit vazio. Se um defeito for corrigido, crie primeiro uma task corretiva com testes RED/GREEN e commit dos arquivos exatos; só então atualize o relatório com o novo commit. Entregue o veredito classificado e as pendências externas ao controlador, sem push ou deploy.
