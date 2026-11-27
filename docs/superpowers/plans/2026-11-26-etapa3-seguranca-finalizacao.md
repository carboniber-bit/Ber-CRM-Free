# Etapa 3 — Segurança, Auditoria, Performance e Finalização Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and implement one task at a time. Write the failing test first where a task says RED, run only that focused test, implement the literal change, run the focused test again for GREEN, then run the task verification. Commit after each task using the command provided. Do not dispatch subagents. Do not edit `0001`–`0012`, the Planos 1–3, or the parallel Relatórios and Configurações/Backup plans. Stop if a dependency named in Task 0 is absent or its actual interface differs; reconcile the dependency in its owning plan instead of inventing a second implementation here.

**Goal:** Entregar a Etapa 3 existente com autenticação recuperável, RLS/grants mínimos, `profiles.role` não autoeditável, `search_path` seguro, integridade relacional e financeira verificável, auditoria append-only transacional, diagnóstico read-only, consultas limitadas/cursorizadas, jornada integrada responsiva, CI Node 24, documentação e relatório final classificado, sem afirmar validação runtime que não tenha evidência.

**Architecture:** React 19/TypeScript/Vite 8/Tailwind v4/React Router 7 continuam sendo a interface. Supabase Auth e o cliente browser com chave pública continuam sendo a única identidade e acesso. PostgreSQL/RLS é a autoridade final; leituras são `security invoker`, escritas sensíveis são RPCs/triggers `security definer` com `search_path = ''`. A migration aditiva `0013_etapa3_security_audit.sql` endurece privilégios e integridade, cria `audit_events`, o adaptador `diagnose_data_integrity()` e funções de performance; a matriz completa de diagnóstico permanece com `0012`/`get_backup_diagnostics()`. O frontend consome apenas RPCs/consultas dono-escopadas; Relatórios, Backup e Recharts são chunks sob demanda.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free/PostgreSQL/Auth, Recharts, Vitest 5, Testing Library/jsdom, Playwright para smoke browser local, GitHub Actions Node 24 e Vercel Hobby. Nenhuma service role key, backend novo, Edge Function, API paga ou upgrade.

**Spec:** `docs/superpowers/specs/2026-11-26-etapa3-finalizacao-design.md`, especialmente seções 10–14 e todos os critérios de aceite.

**Global Constraints:**

- Durante a autoria ou revisão documental, não implemente código, não execute testes/build/lint/SQL, não commite, não despache subagentes e não altere SQL remoto. Os comandos abaixo são instruções para a execução futura autorizada.
- Preserve os Planos 1–3 e os planos paralelos de Relatórios (`0010`) e Configurações/Backup (`0011`–`0012`); declare dependências sem editar esses arquivos. A ordem integral é `0010` → `0011` → `0012` → `0013`; o recorte de settings/backup/auditoria é `0011` → `0012` → `0013`. WP5/`0013` é o único dono de `audit_events`, `public.write_audit_event` e dos triggers de auditoria.
- Não crie Etapa 4. Não recrie o projeto nem troque a stack.
- Migrations novas são aditivas após `0009`; nunca edite migrations históricas.
- Não use service role/APIs pagas, não faça push/deploy/publicação externa nem SQL remoto sem autorização específica.
- Não alegue RLS runtime, persistência autenticada ou publicação sem evidência real. Sem dois proprietários autenticados testados, classifique RLS runtime como `dependente de configuração externa`.
- Dinheiro canônico de Financeiro é inteiro em centavos no TypeScript e `numeric(14,2)` no PostgreSQL. Não confunda contratado, recebido, estimado ou pendente. Campos legados de leads permanecem decimais conforme Plano 1; qualquer conversão de representação é Bloqueio Importante e exige decisão explícita, nunca coerção silenciosa.
- Datas usam `America/Sao_Paulo`, início inclusivo e fim exclusivo. Denominador zero produz `null` nos relatórios.
- Toda evidência de teste precisa ser fresca e conter comando, data, resultado e escopo. Um README ou uma query own-row não prova isolamento RLS.
- Nenhum Critical/Important de segurança, persistência ou integridade financeira pode permanecer aberto para declarar o CRM finalizado.

---

## Dependency and ownership map

| Work package | Owner | Required before this plan | Exact paths and interfaces |
|---|---|---|---|
| WP0 | Plano 1 — Clientes | Pipeline, KPI global, clientes e rotas | `docs/superpowers/plans/2026-11-25-etapa3-plano1-clientes.md`; `supabase/migrations/0006_etapa3_clients.sql`; `supabase/migrations/0007_lead_maps_url.sql`; `src/services/clientService.ts`; `src/types/client.ts`; `src/types/contract.ts`; `src/pages/ClientsPage.tsx`; `src/pages/ClientDetailPage.tsx` |
| WP1 | Plano 2 — Projetos | Tarefas, revisões e RPCs | `docs/superpowers/plans/2026-11-25-etapa3-plano2-projetos.md`; `supabase/migrations/0008_etapa3_projects.sql`; `src/types/project.ts` (`ProjectTask`, `ProjectTaskWrite`, `ProjectRevision`); `src/services/projectService.ts` (`listTasks`, `createTask`, `updateTask`, `reorderTasks`, `listRevisions`); `src/pages/ProjectsPage.tsx` |
| WP2 | Plano 3 — Financeiro | Ledger, RPCs, estornos e saldos | `docs/superpowers/plans/2026-11-25-etapa3-plano3-financeiro.md`; `supabase/migrations/0009_etapa3_finance.sql`; `src/types/finance.ts` (`PaymentInput`, `FinancialPayment`, `PaymentAllocation`, `FinancialExpense`); `src/services/contractService.ts` (`recordPayment`); `src/services/expenseService.ts` (`createExpense`, `payExpense`); `src/services/financialService.ts` (`getFinancialSummary`); `src/pages/FinancePage.tsx` |
| WP3 | Plano paralelo de Relatórios | Agregações canônicas e export cursorizada | `docs/superpowers/plans/2026-11-26-etapa3-relatorios.md`; `supabase/migrations/0010_etapa3_reports.sql`; `src/types/report.ts`; `src/services/reportService.ts` (`loadReportData`, `getReportFilterOptions`, `exportReport`); `src/pages/ReportsPage.tsx`; `src/components/reports/ReportCharts.tsx` |
| WP4 | Plano paralelo de Configurações/Backup | Preferências, manifesto, prévia e restore transacional | `docs/superpowers/plans/2026-11-26-etapa3-configuracoes-backup.md`; `supabase/migrations/0011_etapa3_settings.sql`; `supabase/migrations/0012_etapa3_backup.sql`; `src/types/settings.ts`; `src/types/backup.ts`; `src/services/settingsService.ts`; `src/services/backupService.ts`; `src/pages/SettingsPage.tsx`; `src/pages/BackupPage.tsx` |
| WP5 | Este plano | Segurança, auditoria, integridade, RLS runtime e performance | `supabase/migrations/0013_etapa3_security_audit.sql`; `supabase/tests/etapa3_security.sql`; `src/services/backupService.ts`; `src/types/backup.ts`; `src/pages/BackupPage.tsx`; limites de auth/UI/consulta |
| WP6 | Este plano após WP5 | Jornada, responsividade, CI, docs e relatório | `src/pages/IntegratedJourney.test.tsx`; `playwright.config.ts`; `e2e/journey.spec.ts`; `.github/workflows/ci.yml`; `README.md`; `docs/supabase-schema.md`; `docs/vercel-deploy.md` |

Os proprietários da tabela são os caminhos exatos acima. Leia e reconcilie os arquivos, mas nunca os edite a partir deste plano. Aplique as migrations na ordem integral `0010` → `0011` → `0012` → `0013`. WP4 possui settings, backup, a página `BackupPage` e a única RPC `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`; WP5/`0013` cria exclusivamente o schema, a writer e os triggers de auditoria. A função PL/pgSQL de `0012` pode referenciar `public.write_audit_event` antes de `0013` porque a resolução interna ocorre em execução; nenhum restore ou teste de auditoria é executado antes de `0013`.

**Dependency status at authoring:** `0008`–`0012` ainda não existem no working tree atual. O plano WP4 já declara o contrato canônico abaixo; isso não substitui o gate do Task 0. A execução para quando qualquer migration, página, tipo ou serviço exacto estiver ausente ou com assinatura divergente, sem criar implementação substituta.

**Canonical audit contract:** `public.audit_events(id uuid, owner_id uuid, actor_id uuid, action text, entity_type text, entity_id text, metadata jsonb, created_at timestamptz)` e `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid`. `entity_id` aceita UUID textual e hash SHA-256; `actor_id = owner_id`; `metadata` é JSON object de no máximo 2048 bytes. A writer nega EXECUTE direto a `anon`/`authenticated` e aceita exatamente as chaves/tipos da Task 3. `0011` e `0012` não criam tabela, função ou trigger de auditoria. O restore de `0012` invoca uma única vez a writer canônica com ação `backup.restore`, entidade textual `backup`, hash do pacote e metadados `backup_id`, `restore_id` e `count`; não cria evento por tabela. O serviço de Backup não exige `audit_event_id`. A auditoria genérica é suprimida durante `ber.restore = 'on'`, e uma falha de auditoria reverte o restore inteiro.

---

### Task 0: Establish the baseline, dependency gate and security inventory

**Files:**

- Read: all files under `supabase/migrations/`, `src/`, `.github/` if present, `README.md`, `vercel.json`, `.env.example`, `package.json`, `package-lock.json`.
- Read: the three `2026-11-25-etapa3-plano*.md` plans plus exactly `docs/superpowers/plans/2026-11-26-etapa3-relatorios.md` and `docs/superpowers/plans/2026-11-26-etapa3-configuracoes-backup.md`.
- Modify only after all dependencies pass: none in this task.
- Create: none.

**Interfaces:**

- Input: a working tree containing completed `0001`–`0012` and the corresponding frontend.
- Output: an execution inventory with table/RLS/grant/function/query/credential findings and a go/no-go decision for `0013`.
- Required tables include `profiles`, `leads`, `lead_activities`, `lead_followups`, `lead_digital_checks`, `user_settings`, `clients`, `lead_client_links`, `contracts`, `projects`, `client_activities`, `project_tasks`, `project_revisions`, `expense_categories`, `contract_installments`, `financial_payments`, `financial_payment_allocations`, `financial_expenses`, plus every private settings/backup table introduced by `0011`/`0012`.

- [ ] **Step 1: Confirm the dependency gate before editing.**

Run from the repository root:

```bash
git status --short
git log -5 --oneline
BASELINE=$(git rev-parse HEAD)
printf 'BASELINE=%s\n' "$BASELINE"
ls supabase/migrations
ls docs/superpowers/plans
```

Expected: `0008`, `0009`, `0010`, `0011` and `0012` exist in numeric order; Planos 1–3 and both parallel frontends are merged in the working branch. Record `BASELINE` for later `git diff "$BASELINE"..HEAD`; do not compare only against `main`, because execution may occur on `main`. Record and preserve every pre-existing user change. Stop at Task 0 if any migration/page/RPC is absent, if WP3 has only a service or plan but no literal merged `ReportsPage`, or if the WP4/WP5 ownership and audit-contract conflict described above remains unresolved. Classify the missing dependency as `pendente`; do not create substitute implementations in this plan.

- [ ] **Step 2: Verify the WP4/WP5 boundary against the actual files.**

Read the full WP4 plan and `0012_etapa3_backup.sql`; then run:

```bash
git grep -nE '0013_etapa3_security_audit|write_audit_event|audit_events|restore_backup|audit_event_id' -- docs/superpowers/plans/2026-11-26-etapa3-configuracoes-backup.md supabase/migrations/0012_etapa3_backup.sql src/services/backupService.ts src/components/backup 2>/dev/null || true
```

Pass only if WP4 does not own/create `0013`; `0012` remains the sole owner of `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`; restore calls `public.write_audit_event(v_owner,v_owner,'backup.restore','backup',v_hash,jsonb_build_object('backup_id',v_hash,'restore_id',v_restore_id::text,'count',(v_classification -> 'totals' ->> 'new')::int))` exactly once and emits no `backup.table_restored` event. If `0012` differs, stop and return the issue to WP4's owner; this plan must not edit it. If only `backupService.ts` still requires `audit_event_id`, record that as the Task 5 client reconciliation and continue: Task 5 owns the shared service/type boundary, not the WP4 migration or plan.

- [ ] **Step 3: Re-read the current integration points.**

Read at minimum:

```text
src/components/auth/AuthProvider.tsx
src/components/auth/authContext.ts
src/services/authService.ts
src/pages/LoginPage.tsx
src/routes/ProtectedRoute.tsx
src/routes/AppRoutes.tsx
src/pages/StatusPage.tsx
src/pages/SettingsPage.tsx
src/services/settingsService.ts
src/services/dashboardService.ts
src/pages/DashboardPage.tsx
src/pages/ReportsPage.tsx
src/pages/BackupPage.tsx
src/services/reportService.ts
src/services/backupService.ts
src/services/followupService.ts
src/pages/FollowUpsPage.tsx
src/services/activityService.ts
src/components/leads/LeadTimeline.tsx
src/components/leads/LeadFollowups.tsx
src/services/leadService.ts
src/lib/url.ts
src/lib/csv.ts
src/lib/db.ts
src/components/opportunities/OpportunityCard.tsx
src/pages/LeadDetailPage.tsx
src/components/ErrorBoundary.tsx
supabase/migrations/0001_profiles.sql
supabase/migrations/0002_etapa2.sql
supabase/migrations/0006_etapa3_clients.sql
supabase/migrations/0010_etapa3_reports.sql
supabase/migrations/0011_etapa3_settings.sql
supabase/migrations/0012_etapa3_backup.sql
```

Expected: use the actual current code, not the snapshot in this plan. The dashboard already has a global converted count and six parallel sources; preserve that behavior when replacing client aggregation with the server snapshot. Plan 2 currently permits direct task writes and Plan 3 permits only SELECT on financial tables; do not broaden either contract.

- [ ] **Step 4: Produce the static audit evidence.**

Run:

```bash
git grep -nE 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function|service_role|serviceRole|SERVICE_ROLE|sb_secret_|sk_live_|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' -- . ':!package-lock.json'
git grep -nE 'VITE_SUPABASE_(ANON_KEY|URL)' -- src .env.example README.md
git grep -nE '\.update\(|\.delete\(|\.insert\(|\.upsert\(' -- src/services
git grep -nE '\.range\(|\.limit\(|listFollowups\(|listActivities\(' -- src/services src/pages
git grep -nE 'href=\{(lead|client|project)\.' -- src/components src/pages
```

Expected: no private key, service-role client or untrusted HTML sink. Every stored external URL rendered as `href` is listed for Task 2. Every direct mutation is matched to a table privilege and RLS policy. Every unbounded timeline/export is listed for Task 7 or the owning Reports plan. A clean pattern scan is static evidence only, not a comprehensive secret audit.

- [ ] **Step 5: Record the current static findings and owners.**

The inventory must contain at least these rows, with `file:line`, severity, owner and planned resolution:

| Finding | Initial severity | Resolution |
|---|---|---|
| Table-wide `profiles` UPDATE can change `role` | Critical | Task 3 column grant |
| `handle_new_user` uses `search_path = public` | Important | Task 3 empty path |
| Legacy child FKs omit `owner_id` | Critical | Task 3 preflight + composite FK |
| Important lead/client history is mutable | Important | Task 3 revoke UPDATE/DELETE |
| No append-only audit trail | Important | Tasks 3–4 |
| Auth recovery and deterministic initial loading absent | Important | Task 1 |
| Raw backend errors can reach Status/Settings | Important | Task 2 |
| Stored URLs rendered directly | Important | Task 2 |
| Dashboard loads 1,000 full leads and aggregates in browser | Important | Task 7 server snapshot |
| Follow-up/timeline reads lack stable cursor/limit | Important | Task 7 |
| Recharts and module routes are eager | Moderate | Task 7 lazy chunks |
| CI/security headers/docs absent | Important | Tasks 9–11 |

- [ ] **Step 6: Record the execution baseline without an empty commit.**

Record `BASELINE`, dependency paths and the go/no-go decision in the final-report evidence section specified by Task 11. Do not create a report Markdown file or commit an empty task solely for this inventory; continue to Task 1 only after the gate passes.

---

### Task 1: Harden authentication, recovery, expiry and private-draft cleanup

**Files:**

- Create: `src/lib/privateDrafts.ts`
- Create: `src/lib/privateDrafts.test.ts`
- Create: `src/services/authService.test.ts`
- Create: `src/components/auth/AuthProvider.test.tsx`
- Modify: `src/components/auth/authContext.ts`
- Modify: `src/components/auth/AuthProvider.tsx`
- Modify: `src/services/authService.ts`
- Modify: `src/pages/LoginPage.tsx`
- Create: `src/pages/LoginPage.test.tsx`
- Test: `src/routes/ProtectedRoute.test.tsx`

**Interfaces:**

```ts
interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  recovery: boolean
  signOut: () => Promise<void>
  clearRecovery: () => void
}

requestPasswordReset(email: string): Promise<void>
updatePassword(currentPassword: string, newPassword: string): Promise<void>
clearPrivateDrafts(): void
```

- [ ] **Step 1: Write the failing private-draft test.**

Create `src/lib/privateDrafts.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPrivateDrafts } from './privateDrafts'

describe('clearPrivateDrafts', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('remove apenas rascunhos privados do cliente e preserva outras chaves', () => {
    sessionStorage.setItem('ber-crm:client-draft:v1:owner-A:scope', '{"cnpj":"123"}')
    sessionStorage.setItem('ber-crm:client-draft:v1:owner-B', 'PII')
    sessionStorage.setItem('tema', 'dark')
    localStorage.setItem('tema', 'dark')

    clearPrivateDrafts()

    expect([...sessionStorage.keys]).toEqual(['tema'])
    expect(localStorage.getItem('tema')).toBe('dark')
  })

  it('ignora chaves semelhantes que não são o prefixo exato', () => {
    sessionStorage.setItem('xber-crm:client-draft:v1:owner', 'manter')
    sessionStorage.setItem('ber-crm:client-draft:v10:owner', 'manter')

    clearPrivateDrafts()

    expect(sessionStorage.length).toBe(2)
  })

  it('continua quando o storage está indisponível', () => {
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(() => clearPrivateDrafts()).not.toThrow()
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/lib/privateDrafts.test.ts
```

Expected RED: module does not exist.

- [ ] **Step 2: Implement the draft boundary.**

Create `src/lib/privateDrafts.ts`:

```ts
const CLIENT_DRAFT_PREFIX = 'ber-crm:client-draft:v1:'

export function clearPrivateDrafts(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(CLIENT_DRAFT_PREFIX)) keys.push(key)
    }
    for (const key of keys) sessionStorage.removeItem(key)
  } catch {
    // Storage can be disabled by browser policy. Logout must still complete.
  }
}
```

Run the focused test. Expected GREEN: three tests pass.

- [ ] **Step 3: Write the failing auth service test.**

Create `src/services/authService.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
    },
  },
}))

import { requestPasswordReset, signOut, updatePassword } from './authService'
import { clearPrivateDrafts } from '../lib/privateDrafts'

vi.mock('../lib/privateDrafts', () => ({ clearPrivateDrafts: vi.fn() }))

describe('authService security flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { email: 'pessoa@example.com' } }, error: null })
    mocks.signInWithPassword.mockResolvedValue({ error: null })
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    mocks.updateUser.mockResolvedValue({ error: null })
  })

  it('uses the configured recovery return URL and never reveals account existence', async () => {
    await requestPasswordReset('  pessoa@example.com ')

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('pessoa@example.com', {
      redirectTo: `${window.location.origin}/login?mode=recovery`,
    })
  })

  it('returns the same safe recovery message for backend errors', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: 'secret backend detail' } })

    await expect(requestPasswordReset('pessoa@example.com')).resolves.toBeUndefined()
  })

  it('validates the new password length before any Auth call', async () => {
    await expect(updatePassword('senha-atual-123', 'curta')).rejects.toThrow('Use pelo menos 8 caracteres')
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('re-authenticates with the current password before updating it', async () => {
    const order: string[] = []
    mocks.getUser.mockImplementation(async () => {
      order.push('identity')
      return { data: { user: { email: 'pessoa@example.com' } }, error: null }
    })
    mocks.signInWithPassword.mockImplementation(async () => {
      order.push('reauth')
      return { error: null }
    })
    mocks.updateUser.mockImplementation(async () => {
      order.push('update')
      return { error: null }
    })

    await updatePassword('senha-atual-123', 'senha-segura-456')

    expect(order).toEqual(['identity', 'reauth', 'update'])
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'pessoa@example.com', password: 'senha-atual-123',
    })
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'senha-segura-456' })
    expect(JSON.stringify(localStorage)).not.toContain('senha-atual-123')
    expect(JSON.stringify(localStorage)).not.toContain('senha-segura-456')
    expect(JSON.stringify(sessionStorage)).not.toContain('senha-atual-123')
    expect(JSON.stringify(sessionStorage)).not.toContain('senha-segura-456')
  })

  it('does not update when the current password is rejected and hides the provider detail', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials: private detail' } })

    await expect(updatePassword('senha-atual-errada', 'senha-segura-456')).rejects.toThrow(
      'E-mail ou senha atuais incorretos.',
    )
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('hides backend details from identity, re-authentication and update failures', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'JWT secret' } })
    await expect(updatePassword('senha-atual-123', 'senha-segura-456')).rejects.toThrow(
      'Não foi possível atualizar a senha. Tente novamente.',
    )
    mocks.getUser.mockResolvedValueOnce({ data: { user: { email: 'pessoa@example.com' } }, error: null })
    mocks.signInWithPassword.mockResolvedValueOnce({ error: { message: 'JWT secret' } })
    await expect(updatePassword('senha-atual-123', 'senha-segura-456')).rejects.toThrow(
      'Não foi possível atualizar a senha. Tente novamente.',
    )
    mocks.signInWithPassword.mockResolvedValueOnce({ error: null })
    mocks.updateUser.mockResolvedValueOnce({ error: { message: 'JWT secret detail' } })
    await expect(updatePassword('senha-atual-123', 'senha-segura-456')).rejects.toThrow(
      'Não foi possível atualizar a senha. Tente novamente.',
    )
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })

  it('clears PII drafts before attempting local/remote logout', async () => {
    const order: string[] = []
    vi.mocked(clearPrivateDrafts).mockImplementation(() => order.push('drafts'))
    mocks.signOut.mockImplementation(async () => {
      order.push('auth')
      return { error: null }
    })

    await signOut()

    expect(order).toEqual(['drafts', 'auth'])
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/services/authService.test.ts
```

Expected RED: exports do not exist and logout does not clear drafts.

- [ ] **Step 4: Implement recovery, password update and logout cleanup.**

Replace `src/services/authService.ts` with:

```ts
import { supabase } from '../lib/supabase'
import { clearPrivateDrafts } from '../lib/privateDrafts'

const NOT_CONFIGURED =
  'Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.'

export function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.'
  if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento e tente novamente.'
  if (message.includes('Failed to fetch') || message.includes('fetch')) {
    return 'Falha de conexão com o Supabase. Verifique a URL e sua internet.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error(NOT_CONFIGURED)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error(NOT_CONFIGURED)
  const normalized = email.trim()
  if (!normalized) throw new Error('Informe seu e-mail.')
  const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: `${window.location.origin}/login?mode=recovery`,
  })
  if (error?.message.toLowerCase().includes('rate limit')) {
    throw new Error('Muitas tentativas. Aguarde um momento e tente novamente.')
  }
  // Other provider errors are intentionally not disclosed or used for enumeration.
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (!supabase) throw new Error(NOT_CONFIGURED)
  if (!currentPassword) throw new Error('Informe sua senha atual.')
  if (newPassword.length < 8) throw new Error('Use pelo menos 8 caracteres na nova senha.')
  const genericError = () => new Error('Não foi possível atualizar a senha. Tente novamente.')
  const { data, error: identityError } = await supabase.auth.getUser()
  const email = data.user?.email
  if (identityError || !email) throw genericError()
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (reauthError) throw new Error('E-mail ou senha atuais incorretos.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw genericError()
}

export async function signOut(): Promise<void> {
  clearPrivateDrafts()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error('Não foi possível sair. Tente novamente.')
}
```

The reset service returns no account-specific data. The page displays the same generic message after the call resolves; that message is not proof of delivery or account existence.

Run the focused test. Expected GREEN.

- [ ] **Step 5: Write the failing AuthProvider test.**

Create `src/components/auth/AuthProvider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from '../hooks/useAuth'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}))

vi.mock('../../services/authService', () => ({ signOut: vi.fn() }))

function Probe() {
  const { user, loading, recovery } = useAuth()
  return <output>{loading ? 'loading' : `${user?.id ?? 'anon'}:${recovery}`}</output>
}

const session = {
  access_token: 'test-token',
  refresh_token: 'test-refresh',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'owner-A' },
} as unknown as Session

let emit: (event: string, value: Session | null) => void

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/login')
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.onAuthStateChange.mockImplementation((callback: typeof emit) => {
      emit = callback
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('finishes initial loading from the auth event even before getSession settles', async () => {
    let resolveSession: (value: { data: { session: Session }; error: null }) => void = () => undefined
    mocks.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))
    render(<AuthProvider><Probe /></AuthProvider>)

    expect(screen.getByText('loading')).toBeTruthy()
    await act(async () => { emit('SIGNED_IN', session) })
    expect(screen.getByText('owner-A:false')).toBeTruthy()

    await act(async () => { resolveSession({ data: { session: null }, error: null }) })
    expect(screen.getByText('owner-A:false')).toBeTruthy()
    expect(mocks.unsubscribe).not.toHaveBeenCalled()
  })

  it('clears a rejected initial session without leaking the error', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'JWT internals' } })
    render(<AuthProvider><Probe /></AuthProvider>)

    expect(await screen.findByText('anon:false')).toBeTruthy()
    expect(screen.queryByText(/JWT internals/)).toBeNull()
  })

  it('enters recovery on PASSWORD_RECOVERY and leaves on SIGNED_OUT', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('owner-A:false')

    await act(async () => { emit('PASSWORD_RECOVERY', session) })
    expect(screen.getByText('owner-A:true')).toBeTruthy()

    await act(async () => { emit('SIGNED_OUT', null) })
    expect(screen.getByText('anon:false')).toBeTruthy()
  })

  it('recognizes the recovery URL before the first session arrives', async () => {
    window.history.replaceState({}, '', '/login?mode=recovery')
    render(<AuthProvider><Probe /></AuthProvider>)

    expect(await screen.findByText('owner-A:true')).toBeTruthy()
  })

  it('rechecks an expired session and clears it when Auth rejects it', async () => {
    vi.useFakeTimers()
    const expired = { ...session, expires_at: Math.floor(Date.now() / 1000) + 31 } as Session
    mocks.getSession.mockResolvedValueOnce({ data: { session: expired }, error: null })
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: { message: 'expired' } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('owner-A:false')).toBeTruthy()

    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })

    expect(mocks.getSession).toHaveBeenCalledTimes(2)
    expect(screen.getByText('anon:false')).toBeTruthy()
  })

  it('ignores an expiry response that arrives after unmount', async () => {
    vi.useFakeTimers()
    let resolveExpiry: (value: { data: { session: null }; error: null }) => void = () => undefined
    const expired = { ...session, expires_at: Math.floor(Date.now() / 1000) + 31 } as Session
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: expired }, error: null })
      .mockReturnValueOnce(new Promise((resolve) => { resolveExpiry = resolve }))
    const view = render(<AuthProvider><Probe /></AuthProvider>)
    await act(async () => { await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    view.unmount()

    await act(async () => { resolveExpiry({ data: { session: null }, error: null }) })

    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes on unmount', async () => {
    const view = render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('owner-A:false')
    view.unmount()
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/components/auth/AuthProvider.test.tsx
```

Expected RED: context lacks `recovery`; rejected `getSession` never resolves; no expiry recheck; stale initial/expiry responses can overwrite newer auth state.

- [ ] **Step 6: Implement deterministic AuthProvider state and expiry.**

Replace `src/components/auth/authContext.ts`:

```ts
import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  recovery: boolean
  signOut: () => Promise<void>
  clearRecovery: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
```

Replace `src/components/auth/AuthProvider.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { clearPrivateDrafts } from '../../lib/privateDrafts'
import { signOut as serviceSignOut } from '../../services/authService'
import { AuthContext, type AuthContextValue } from './authContext'

function hasRecoveryUrl(): boolean {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return query.get('mode') === 'recovery' || hash.get('type') === 'recovery'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [recovery, setRecovery] = useState(hasRecoveryUrl)
  const previousUserId = useRef<string | null>(null)
  const authRevision = useRef(0)

  useEffect(() => {
    if (!supabase) return
    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return
      authRevision.current += 1
      const nextUserId = newSession?.user.id ?? null
      if (nextUserId !== previousUserId.current || event === 'SIGNED_OUT') {
        clearPrivateDrafts()
        previousUserId.current = nextUserId
      }
      setSession(newSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })

    const revision = authRevision.current
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authRevision.current !== revision) return
      setSession(error ? null : data.session)
      previousUserId.current = error ? null : data.session?.user.id ?? null
      setLoading(false)
    }).catch(() => {
      if (!active || authRevision.current !== revision) return
      setSession(null)
      previousUserId.current = null
      setLoading(false)
    })

    return () => {
      active = false
      authRevision.current += 1
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.expires_at) return
    let active = true
    const revision = authRevision.current
    const delay = Math.max(0, session.expires_at * 1000 - Date.now() - 30_000)
    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!active || authRevision.current !== revision) return
        setSession(error ? null : data.session)
        previousUserId.current = error ? null : data.session?.user.id ?? null
        if (error || !data.session) setRecovery(false)
      }).catch(() => {
        if (!active || authRevision.current !== revision) return
        setSession(null)
        previousUserId.current = null
        setRecovery(false)
      })
    }, delay)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [session?.expires_at])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    recovery,
    signOut: serviceSignOut,
    clearRecovery: () => setRecovery(false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

Run the focused test. Expected GREEN. StrictMode may mount twice in development; `active` prevents unmounted callbacks from updating state, and `authRevision` prevents a slow `getSession()` from overwriting a newer auth event. Each subscription and timer is independently cleaned up.

- [ ] **Step 7: Replace LoginPage with login/recovery/new-password modes.**

Replace `src/pages/LoginPage.tsx` with:

```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { KeyRound, LogIn, TriangleAlert } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'
import { requestPasswordReset, signIn, updatePassword } from '../services/authService'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

type Mode = 'login' | 'recover' | 'password'

export function LoginPage() {
  const { session, loading, recovery, clearRecovery } = useAuth()
  const [mode, setMode] = useState<Mode>(recovery ? 'password' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (recovery) setMode('password')
  }, [recovery])

  if (!loading && session && !recovery) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (mode === 'password') {
      if (!currentPassword) {
        setError('Informe sua senha atual.')
        return
      }
      if (password.length < 8) {
        setError('Use pelo menos 8 caracteres na nova senha.')
        return
      }
      if (password !== confirmation) {
        setError('A confirmação não coincide com a nova senha.')
        return
      }
      setSubmitting(true)
      try {
        await updatePassword(currentPassword, password)
        setCurrentPassword('')
        setPassword('')
        setConfirmation('')
        clearRecovery()
      } catch (cause) {
        const safeMessages = ['Informe sua senha atual.', 'Use pelo menos 8 caracteres na nova senha.', 'E-mail ou senha atuais incorretos.']
        setError(cause instanceof Error && safeMessages.includes(cause.message)
          ? cause.message
          : 'Não foi possível atualizar a senha. Tente novamente.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!email.trim() || (mode === 'login' && !password)) {
      setError(mode === 'login' ? 'Informe e-mail e senha.' : 'Informe seu e-mail.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        await requestPasswordReset(email.trim())
        setMessage('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.')
        setMode('login')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!isSupabaseConfigured && (
        <Card className="border-lime/30">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-lime" />
            <div className="text-sm">
              <p className="font-medium text-ink">Supabase não configurado</p>
              <p className="mt-1 text-muted">
                Preencha as chaves no <code className="text-lime">.env.local</code>.{' '}
                <Link to="/status" className="text-accent underline-offset-2 hover:underline">Ver diagnóstico</Link>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card title={mode === 'password' ? 'Definir nova senha' : mode === 'recover' ? 'Recuperar acesso' : 'Entrar'} dot="mint">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {mode !== 'password' && (
            <Input
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}

          {mode === 'login' && (
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}

          {mode === 'password' && (
            <>
              {!session && <p role="alert" className="text-sm text-danger">O link é inválido ou expirou. Solicite um novo link.</p>}
              <Input
                label="Senha atual"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <Input
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Input
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </>
          )}

          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm text-ink">{message}</p>}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="mint"
              loading={submitting}
              disabled={!isSupabaseConfigured || (mode === 'password' && !session)}
            >
              {mode === 'password' ? <KeyRound className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {mode === 'password' ? 'Salvar nova senha' : mode === 'recover' ? 'Enviar link' : 'Entrar'}
            </Button>
            {mode === 'password' && (
              <Button
                type="button"
                loading={submitting}
                onClick={() => {
                  setCurrentPassword('')
                  setPassword('')
                  setConfirmation('')
                  clearRecovery()
                }}
              >
                Cancelar alteração
              </Button>
            )}
          </div>
        </form>

        {mode !== 'password' && (
          <button
            type="button"
            className="mt-4 text-xs text-accent underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === 'recover' ? 'login' : 'recover')
              setError(null)
              setMessage(null)
            }}
          >
            {mode === 'recover' ? 'Voltar para o login' : 'Esqueci minha senha'}
          </button>
        )}
        <p className="mt-4 text-xs text-muted/70">Acesso restrito. Contas são criadas pelo administrador no painel do Supabase.</p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: Add route/recovery component tests and verify auth.**

Create `src/pages/LoginPage.test.tsx`. The test renders the real form; only auth context/service boundaries are mocked. Passwords remain in transient component state, are cleared on success/cancel and never written to storage or logs.

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const mocks = vi.hoisted(() => ({
  auth: {
    session: null as unknown,
    loading: false,
    recovery: true,
    signOut: vi.fn(),
    clearRecovery: vi.fn(),
  },
  requestPasswordReset: vi.fn(),
  signIn: vi.fn(),
  updatePassword: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('../services/authService', () => ({
  requestPasswordReset: mocks.requestPasswordReset,
  signIn: mocks.signIn,
  updatePassword: mocks.updatePassword,
}))

function renderRecovery() {
  mocks.auth.session = { user: { id: 'owner-A', email: 'pessoa@example.com' } }
  mocks.auth.recovery = true
  render(<MemoryRouter initialEntries={['/login?mode=recovery']}><LoginPage /></MemoryRouter>)
}

function fillPasswords(current = 'senha-atual-123', next = 'senha-segura-456') {
  fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: next } })
}

describe('LoginPage password recovery boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mocks.auth.loading = false
    mocks.auth.session = null
    mocks.auth.recovery = false
    mocks.requestPasswordReset.mockResolvedValue(undefined)
    mocks.signIn.mockResolvedValue(undefined)
    mocks.updatePassword.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows only the generic recovery result', async () => {
    mocks.requestPasswordReset.mockRejectedValue(new Error('JWT SELECT secret account detail'))
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'pessoa@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível concluir. Tente novamente.')
    expect(screen.queryByText(/JWT|secret|SELECT/i)).toBeNull()
  })

  it('rejects mismatched confirmation and a missing current password without calling Auth', () => {
    renderRecovery()
    fillPasswords()
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'diferente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByRole('alert').textContent).toContain('A confirmação não coincide')
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'senha-segura-456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByRole('alert').textContent).toContain('Informe sua senha atual.')
    expect(mocks.updatePassword).not.toHaveBeenCalled()
  })

  it('submits current/new passwords once, exposes loading and clears all secrets on success', async () => {
    let finish: () => void = () => undefined
    mocks.updatePassword.mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderRecovery()
    fillPasswords()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith('senha-atual-123', 'senha-segura-456'))
    expect((screen.getByRole('button', { name: 'Salvar nova senha' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.clearRecovery).not.toHaveBeenCalled()
    finish()
    await waitFor(() => expect(mocks.clearRecovery).toHaveBeenCalledTimes(1))
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Confirmar nova senha') as HTMLInputElement).value).toBe('')
    expect(JSON.stringify(localStorage)).not.toContain('senha-atual-123')
    expect(JSON.stringify(sessionStorage)).not.toContain('senha-segura-456')
    expect(log).not.toHaveBeenCalled()
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('hides backend details and retains the form for a retry', async () => {
    mocks.updatePassword.mockRejectedValue(new Error('JWT SELECT secret password'))
    renderRecovery()
    fillPasswords()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível atualizar a senha. Tente novamente.')
    expect(screen.queryByText(/JWT|secret|SELECT/i)).toBeNull()
    expect(mocks.clearRecovery).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('senha-atual-123')
  })

  it('cancels without calling the update service and clears every password field', () => {
    renderRecovery()
    fillPasswords()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar alteração' }))

    expect(mocks.updatePassword).not.toHaveBeenCalled()
    expect(mocks.clearRecovery).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Confirmar nova senha') as HTMLInputElement).value).toBe('')
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/lib/privateDrafts.test.ts src/services/authService.test.ts src/components/auth/AuthProvider.test.tsx src/pages/LoginPage.test.tsx src/routes/ProtectedRoute.test.tsx
```

Expected GREEN: focused tests pass. Browser persistence and real recovery-link delivery remain external until Task 6; build and lint belong to the final Task 11 gate.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/privateDrafts.ts src/lib/privateDrafts.test.ts src/services/authService.ts src/services/authService.test.ts src/components/auth/authContext.ts src/components/auth/AuthProvider.tsx src/components/auth/AuthProvider.test.tsx src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx src/routes/ProtectedRoute.test.tsx
git commit -m "fix: endurecer autenticacao e recuperacao de acesso"
```

---

### Task 2: Close frontend error, URL, XSS, CSV and diagnostic boundaries

**Files:**

- Create: `src/lib/publicError.ts`
- Create: `src/lib/publicError.test.ts`
- Create: `src/lib/safeExternalUrl.ts`
- Create: `src/lib/safeExternalUrl.test.tsx`
- Modify: `src/lib/url.ts` only if a reusable exported boundary is needed; do not duplicate its validators.
- Modify: `src/lib/csv.ts`
- Modify: `src/lib/csv.test.ts`
- Modify: `src/components/opportunities/OpportunityCard.tsx`
- Modify: `src/pages/LeadDetailPage.tsx`
- Modify: `src/pages/StatusPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/services/clientService.ts`
- Modify: `src/components/ErrorBoundary.tsx`
- Test: `src/pages/StatusPage.test.tsx`, `src/pages/SettingsPage.test.tsx`, `src/pages/DashboardPage.test.tsx`, `src/components/ErrorBoundary.test.tsx`

**Interfaces:**

```ts
toPublicErrorMessage(cause: unknown, fallback: string): string
safeExternalUrl(kind: 'website' | 'instagram', raw: string | null | undefined): string | null
CSV_ESCAPE_FORMULAE: RegExp
protectCsvCell(value: unknown): string
```

- [ ] **Step 1: Write failing error and URL boundary tests.**

Create `src/lib/publicError.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toPublicErrorMessage } from './publicError'

describe('toPublicErrorMessage', () => {
  it('never returns raw backend details', () => {
    expect(toPublicErrorMessage(new Error('permission denied for table secrets by role anon'), 'Falha ao salvar.'))
      .toBe('Falha ao salvar.')
    expect(toPublicErrorMessage('JWT: supabase.secret', 'Falha ao salvar.')).toBe('Falha ao salvar.')
  })

  it('permits apenas mensagens públicas explicitamente cadastradas', () => {
    expect(toPublicErrorMessage(new Error('Registro duplicado.'), 'Falha ao salvar.')).toBe('Registro duplicado.')
    expect(toPublicErrorMessage(new Error('Já existe um cliente com este CNPJ.'), 'Falha ao salvar.'))
      .toBe('Já existe um cliente com este CNPJ.')
  })
})
```

Create `src/lib/safeExternalUrl.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { safeExternalUrl } from './safeExternalUrl'

function LinkFixture({ value }: { value: string }) {
  const href = safeExternalUrl('website', value)
  return href ? <a href={href}>Abrir</a> : <span>Indisponível</span>
}

afterEach(cleanup)

describe('safeExternalUrl', () => {
  it.each(['javascript:alert(1)', 'data:text/html,<script>x</script>', 'blob:https://example.test/x', '//example.test', 'https://user:pass@example.test', 'https://example.test/%zz'])(
    'does not create an anchor for %s',
    (value) => {
      render(<LinkFixture value={value} />)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText('Indisponível')).toBeTruthy()
    },
  )

  it('accepts a normalized HTTP(S) website', () => {
    expect(safeExternalUrl('website', 'example.com/path')).toBe('https://example.com/path')
  })

  it('accepts Instagram handles and rejects another host', () => {
    expect(safeExternalUrl('instagram', '@barbearia')).toBe('https://www.instagram.com/barbearia/')
    expect(safeExternalUrl('instagram', 'https://example.com/instagram')).toBeNull()
  })

  it('renders untrusted text as text, not HTML', () => {
    const value = '<img src=x onerror=alert(1)>'
    render(<LinkFixture value={value} />)
    expect(document.querySelector('img')).toBeNull()
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/lib/publicError.test.ts src/lib/safeExternalUrl.test.tsx
```

Expected RED: modules do not exist.

- [ ] **Step 2: Implement public errors and safe URLs.**

Create `src/lib/publicError.ts`:

```ts
const PUBLIC_MESSAGES = new Set([
  'Registro duplicado.',
  'Já existe um cliente com este CNPJ.',
  'Sem permissão no banco. Verifique se a migration foi executada (grants/RLS).',
  'Falha de conexão com o Supabase. Verifique sua internet.',
  'Acesso negado pelas regras de segurança (RLS).',
  'Não foi possível concluir a operação. Tente novamente.',
  'E-mail ou senha incorretos.',
  'E-mail ainda não confirmado. Verifique sua caixa de entrada.',
  'Muitas tentativas. Aguarde um momento e tente novamente.',
  'Falha de conexão com o Supabase. Verifique a URL e sua internet.',
  'Não foi possível entrar. Tente novamente.',
  'Não foi possível sair. Tente novamente.',
  'Não foi possível atualizar a senha. Tente novamente.',
])

export function toPublicErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && PUBLIC_MESSAGES.has(cause.message) ? cause.message : fallback
}
```

Create `src/lib/safeExternalUrl.ts`:

```ts
import { normalizeInstagramUrl, normalizeUrl } from './url'

export type ExternalUrlKind = 'website' | 'instagram'

export function safeExternalUrl(kind: ExternalUrlKind, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const normalized = kind === 'instagram' ? normalizeInstagramUrl(raw) : normalizeUrl(raw)
  if (!normalized) return null
  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}
```

Run the focused tests. Expected GREEN.

- [ ] **Step 3: Apply the URL boundary at every stored-link render site.**

In `src/components/opportunities/OpportunityCard.tsx`, add:

```ts
import { safeExternalUrl } from '../../lib/safeExternalUrl'
```

Before `return`, add:

```ts
const instagramUrl = safeExternalUrl('instagram', lead.instagram)
const websiteUrl = safeExternalUrl('website', lead.website)
```

Replace the two direct anchors with:

```tsx
{instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><AtSign className="h-3 w-3" /> Instagram</a>}
{websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Globe className="h-3 w-3" /> Site</a>}
```

In `src/pages/LeadDetailPage.tsx`, locate every object in the external-link list and change its construction to:

```ts
const url = safeExternalUrl('website', rawUrl)
return url ? { label, url } : null
```

Filter nulls before rendering and use `rel="noopener noreferrer"`. Apply the same boundary to client/project delivery and files links introduced by Planos 1–3. Do not change `WhatsAppDialog`'s existing `about:blank`, `popup.opener = null` and validated WhatsApp URL pattern.

Add a component test that supplies `javascript:`, `data:`, `blob:`, malformed percent escapes and a valid URL to `OpportunityCard`; assert that only the valid URL becomes an anchor and that `rel` contains both `noopener` and `noreferrer`.

- [ ] **Step 4: Sanitize visible errors without discarding safe domain messages.**

In `src/pages/StatusPage.tsx`, import `toPublicErrorMessage` and replace raw error interpolation with:

```ts
update('session', 'error', toPublicErrorMessage(sessionError, 'Não foi possível validar a sessão.'))
update('profiles', 'error', toPublicErrorMessage(profileError, 'Não foi possível consultar profiles. Verifique as migrations.'))
```

Replace the success detail with exactly:

```text
Consulta do próprio perfil acessível; isolamento entre proprietários não comprovado por esta verificação.
```

In `src/pages/SettingsPage.tsx`, replace both raw `e.message` paths with:

```ts
const message = toPublicErrorMessage(e, 'Erro ao carregar configurações.')
```

and:

```ts
toast(toPublicErrorMessage(e, 'Erro ao salvar configurações.'), 'error')
```

In `src/pages/DashboardPage.tsx`, replace the raw error assignment with:

```ts
setError(toPublicErrorMessage(cause, 'Erro ao carregar dashboard.'))
```

In `src/services/clientService.ts`, replace the CNPJ error interpolation with:

```ts
throw new Error('Já existe um cliente com este CNPJ.')
```

In `src/components/ErrorBoundary.tsx`, remove raw error/component-stack console output. Keep the generic UI and use only:

```ts
console.error('Erro de interface não tratado.')
```

Run:

```bash
git grep -nE 'sessionError\.message|profileError\.message|error\.message\.split|e\.message|err\.message' -- src/pages src/components
npm test -- --maxWorkers=2 src/pages/StatusPage.test.tsx src/pages/SettingsPage.test.tsx src/pages/DashboardPage.test.tsx src/components/ErrorBoundary.test.tsx src/lib/publicError.test.ts src/lib/safeExternalUrl.test.tsx
```

Expected: no raw backend detail is rendered; any remaining `e.message` use is first passed through `toPublicErrorMessage` or is a static message from an auth service covered by Task 1. Focused tests pass.

- [ ] **Step 5: Share and prove the CSV formula primitive.**

In `src/lib/csv.ts`, add near the imports:

```ts
export const CSV_ESCAPE_FORMULAE = /^(?:[\t\r]|\s*[=+\-@])/

export function protectCsvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return CSV_ESCAPE_FORMULAE.test(text) ? `'${text}` : text
}
```

Replace the inline Papa option with:

```ts
{ newline: '\n', escapeFormulae: CSV_ESCAPE_FORMULAE }
```

Add to `src/lib/csv.test.ts`:

```ts
import { protectCsvCell } from './csv'

describe('protectCsvCell', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '  =1'])('neutralizes %s', (value) => {
    expect(protectCsvCell(value).startsWith("'")).toBe(true)
  })

  it('preserves ordinary text and empty values', () => {
    expect(protectCsvCell('Maria')).toBe('Maria')
    expect(protectCsvCell(null)).toBe('')
  })
})
```

Keep the legacy lead export comma/LF contract. The Reports plan owns UTF-8/BOM/`;`/pt-BR formatting and must reuse `CSV_ESCAPE_FORMULAE`; verify that integration in Task 8 rather than silently changing legacy lead files.

- [ ] **Step 6: Verify and commit.**

```bash
git grep -nE 'dangerouslySetInnerHTML|innerHTML\s*=|eval\(|new Function' -- src
npm test -- --maxWorkers=2 src/lib/publicError.test.ts src/lib/safeExternalUrl.test.tsx src/lib/csv.test.ts src/pages/StatusPage.test.tsx src/pages/SettingsPage.test.tsx src/components/opportunities/OpportunityCard.test.tsx src/pages/LeadDetailPage.test.tsx
git add src/lib/publicError.ts src/lib/publicError.test.ts src/lib/safeExternalUrl.ts src/lib/safeExternalUrl.test.tsx src/lib/csv.ts src/lib/csv.test.ts src/components/opportunities/OpportunityCard.tsx src/pages/LeadDetailPage.tsx src/pages/StatusPage.tsx src/pages/StatusPage.test.tsx src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/services/clientService.ts src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx
git commit -m "fix: limitar erros expostos e URLs renderizadas"
```

Expected: no untrusted HTML sink, no unsafe anchor, no raw backend detail in UI and no CSV formula regression.

---

### Task 3: Create the additive 0013 hardening, audit, diagnostics and performance migration

**Files:**

- Create: `supabase/migrations/0013_etapa3_security_audit.sql`
- Read but do not edit: `0010_etapa3_reports.sql`, `0011_etapa3_settings.sql`, `0012_etapa3_backup.sql`.

**Interfaces produced:**

```text
audit_events(id, owner_id, actor_id, action, entity_type, entity_id text, metadata, created_at)
public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid  -- trigger/RPC-only, no client EXECUTE
public.diagnose_data_integrity() returns jsonb  -- security invoker adapter; delegates to WP4 get_backup_diagnostics()
-- { generated_at, schema_version, checks: [{ code, severity, count, sample_ids }], limits }
public.list_followups_cursor(text,timestamptz,uuid,integer) returns jsonb
public.list_lead_followups_cursor(uuid,timestamptz,uuid,integer) returns jsonb
public.list_lead_activities_cursor(uuid,timestamptz,uuid,integer) returns jsonb
public.get_dashboard_snapshot(timestamptz) returns jsonb
```

- [ ] **Step 1: Inspect the actual `0012` restore function before writing the migration.**

Record the exact signature `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`, owner validation, transaction-local `ber.restore` scope and explicit audit call, but do not edit `0012`. Pass only if WP4 already calls the canonical writer exactly once with `actor_id = owner_id`, action `backup.restore`, entity type `backup`, package SHA-256 hash as textual `entity_id`, and metadata `backup_id`, `restore_id` and `count`; emits no `backup.table_restored`; and its service does not require `audit_event_id`. The function may reference the writer before `0013` exists; restore execution and audit tests wait until `0013`. If incompatible, stop and return the issue to WP4's owner; never duplicate, rename or patch restore here.

- [ ] **Step 2: Write the complete migration.**

Create `supabase/migrations/0013_etapa3_security_audit.sql` with the following literal content. The preflight intentionally aborts on bad existing data; it never updates, deletes or backfills rows.

```sql
-- supabase/migrations/0013_etapa3_security_audit.sql
-- Additive Etapa 3 hardening. Requires 0001-0012. Never edit historical migrations.
begin;

-- ============ PROFILES AND FUNCTION SEARCH PATHS ============
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 0012 owns restore and supplies package timestamps. Only its transaction-local
  -- scope bypasses the normal timestamp; every ordinary UPDATE still refreshes it.
  if pg_catalog.current_setting('ber.restore', true) = 'on' then
    return new;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ============ LEAST-PRIVILEGE GRANTS ============
revoke update, delete on public.lead_activities from authenticated;
drop policy if exists activities_update_own on public.lead_activities;
drop policy if exists activities_delete_own on public.lead_activities;

revoke delete on public.user_settings from authenticated;
revoke all on public.client_activities from public, anon, authenticated;
grant select on public.client_activities to authenticated;

revoke all on public.contracts from public, anon, authenticated;
grant select on public.contracts to authenticated;
revoke all on public.contract_installments from public, anon, authenticated;
grant select on public.contract_installments to authenticated;
revoke all on public.financial_payments from public, anon, authenticated;
grant select on public.financial_payments to authenticated;
revoke all on public.financial_payment_allocations from public, anon, authenticated;
grant select on public.financial_payment_allocations to authenticated;
revoke all on public.financial_expenses from public, anon, authenticated;
grant select on public.financial_expenses to authenticated;

-- ============ PREFLIGHT: NO AUTOMATIC REPAIR ============
do $$
begin
  if exists (
    select 1 from public.lead_activities a
    left join public.leads l on l.id = a.lead_id
    where l.id is null or l.owner_id <> a.owner_id
  ) then
    raise exception 'PREFLIGHT_LEAD_ACTIVITIES: existem orfaos ou donos incompativeis; corrija manualmente com backup antes de 0013.';
  end if;
  if exists (
    select 1 from public.lead_followups f
    left join public.leads l on l.id = f.lead_id
    where l.id is null or l.owner_id <> f.owner_id
  ) then
    raise exception 'PREFLIGHT_LEAD_FOLLOWUPS: existem orfaos ou donos incompativeis; corrija manualmente com backup antes de 0013.';
  end if;
  if exists (
    select 1 from public.lead_digital_checks c
    left join public.leads l on l.id = c.lead_id
    where l.id is null or l.owner_id <> c.owner_id
  ) then
    raise exception 'PREFLIGHT_LEAD_DIGITAL_CHECKS: existem orfaos ou donos incompativeis; corrija manualmente com backup antes de 0013.';
  end if;
  if exists (
    select 1 from public.leads
    where estimated_value < 0 or negotiated_value < 0 or contracted_value < 0 or received_value < 0
       or length(pg_catalog.btrim(name)) = 0 or length(name) > 200
  ) then
    raise exception 'PREFLIGHT_LEADS: nomes ou valores legados invalidos; corrija manualmente com backup antes de 0013.';
  end if;
  if exists (
    select 1 from public.lead_followups
    where (status = 'concluido' and completed_at is null)
       or (status <> 'concluido' and completed_at is not null)
  ) then
    raise exception 'PREFLIGHT_FOLLOWUPS: conclusao e completed_at divergentes; corrija manualmente antes de 0013.';
  end if;
  if exists (
    select 1 from public.contracts
    where (status = 'cancelled' and cancelled_at is null)
       or (status <> 'cancelled' and cancelled_at is not null)
  ) then
    raise exception 'PREFLIGHT_CONTRACTS: cancelamento e cancelled_at divergentes; corrija manualmente antes de 0013.';
  end if;
  if exists (
    select 1 from public.financial_expenses where due_date < expense_date
  ) then
    raise exception 'PREFLIGHT_EXPENSES: due_date anterior a expense_date; corrija manualmente antes de 0013.';
  end if;
  if exists (
    select 1 from public.user_settings s
    where pg_catalog.jsonb_typeof(s.service_prices) <> 'object'
       or case when pg_catalog.jsonb_typeof(s.service_prices) = 'object' then
            exists (
              select 1 from pg_catalog.jsonb_each(s.service_prices) e
              where case when pg_catalog.jsonb_typeof(e.value) = 'number'
                then (e.value::text)::numeric < 0 else true end
            )
          else true end
  ) then
    raise exception 'PREFLIGHT_SETTINGS: service_prices contem valor invalido; corrija manualmente antes de 0013.';
  end if;
  if exists (
    select 1 from public.lead_digital_checks
    where (verified and verified_at is null)
       or (not verified and verified_at is not null)
  ) then
    raise exception 'PREFLIGHT_DIGITAL_CHECKS: verified e verified_at divergentes; corrija manualmente antes de 0013.';
  end if;
  if exists (select 1 from public.profiles where full_name is not null and length(full_name) > 120) then
    raise exception 'PREFLIGHT_PROFILES: full_name excede 120 caracteres; corrija manualmente antes de 0013.';
  end if;
end;
$$;

-- ============ LEGACY COMPOSITE OWNER FKS ============
alter table public.lead_activities drop constraint lead_activities_lead_id_fkey;
alter table public.lead_activities
  add constraint lead_activities_lead_owner_fk
  foreign key (owner_id, lead_id) references public.leads (owner_id, id) on delete cascade;

alter table public.lead_followups drop constraint lead_followups_lead_id_fkey;
alter table public.lead_followups
  add constraint lead_followups_lead_owner_fk
  foreign key (owner_id, lead_id) references public.leads (owner_id, id) on delete cascade;

alter table public.lead_digital_checks drop constraint lead_digital_checks_lead_id_fkey;
alter table public.lead_digital_checks
  add constraint lead_digital_checks_lead_owner_fk
  foreign key (owner_id, lead_id) references public.leads (owner_id, id) on delete cascade;

-- ============ CHECKS MISSING FROM LEGACY TABLES ============
alter table public.leads drop constraint if exists leads_money_nonnegative;
alter table public.leads add constraint leads_money_nonnegative check (
  estimated_value >= 0 and negotiated_value >= 0 and contracted_value >= 0 and received_value >= 0
);
alter table public.leads drop constraint if exists leads_name_length_check;
alter table public.leads add constraint leads_name_length_check check (
  length(pg_catalog.btrim(name)) between 1 and 200
);
alter table public.lead_followups drop constraint if exists lead_followups_state_check;
alter table public.lead_followups add constraint lead_followups_state_check check (
  (status = 'concluido' and completed_at is not null)
  or (status <> 'concluido' and completed_at is null)
);
alter table public.lead_digital_checks drop constraint if exists lead_digital_checks_verified_check;
alter table public.lead_digital_checks add constraint lead_digital_checks_verified_check check (
  (verified and verified_at is not null) or (not verified and verified_at is null)
);
alter table public.contracts drop constraint if exists contracts_cancelled_check;
alter table public.contracts add constraint contracts_cancelled_check check (
  (status = 'cancelled' and cancelled_at is not null)
  or (status <> 'cancelled' and cancelled_at is null)
);
alter table public.financial_expenses drop constraint if exists financial_expenses_dates_check;
alter table public.financial_expenses add constraint financial_expenses_dates_check check (
  due_date is null or due_date >= expense_date
);
alter table public.profiles drop constraint if exists profiles_full_name_length_check;
alter table public.profiles add constraint profiles_full_name_length_check check (
  full_name is null or length(full_name) <= 120
);
create or replace function public.validate_service_prices(p_value jsonb)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) = 'object' then
    not exists (
      select 1 from pg_catalog.jsonb_each(p_value) e
      where case when pg_catalog.jsonb_typeof(e.value) = 'number'
        then (e.value::text)::numeric < 0 else true end
    )
  else false end;
$$;
revoke all on function public.validate_service_prices(jsonb) from public, anon;
grant execute on function public.validate_service_prices(jsonb) to authenticated;
alter table public.user_settings drop constraint if exists user_settings_prices_check;
alter table public.user_settings add constraint user_settings_prices_check check (
  public.validate_service_prices(service_prices)
);

-- ============ OWNER IMMUTABILITY ============
create or replace function public.guard_owner_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.owner_id is distinct from new.owner_id then
    raise exception 'OWNER_IMMUTABLE: owner_id nao pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_owner_immutable() from public, anon, authenticated;

-- ============ APPEND-ONLY AUDIT ============
-- ON DELETE RESTRICT is intentional: routine auth-user deletion must not erase audit.
-- A separately authorized retention/user-deletion procedure is required before such deletion.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  actor_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  entity_type text not null check (length(entity_type) between 1 and 80),
  -- UUID textual for business rows and SHA-256 hexadecimal for backup packages.
  entity_id text not null check (length(entity_id) between 1 and 128),
  metadata jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint audit_events_actor_owner_check check (actor_id = owner_id),
  constraint audit_events_metadata_size_check check (pg_catalog.pg_column_size(metadata) <= 2048)
);

create index audit_events_owner_created_idx on public.audit_events (owner_id, created_at desc, id desc);
create index audit_events_owner_entity_idx on public.audit_events (owner_id, entity_type, entity_id, created_at desc);

alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;
create policy audit_events_select_own on public.audit_events
  for select using (auth.uid() = owner_id);

create or replace function public.is_valid_uuid_text(p_value jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) = 'string' then
    (p_value #>> '{}') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  else false end;
$$;
revoke all on function public.is_valid_uuid_text(jsonb) from public, anon, authenticated;

-- Exact allowlist: previous_status, status, amount_cents, kind, reason_code,
-- contract_id, project_id, client_id, lead_id, restore_id, settings_version,
-- count, version, backup_id, payment_type, reason. No raw rows or secrets.
create or replace function public.write_audit_event(
  p_owner_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_audit_id uuid;
begin
  if p_owner_id is null or p_actor_id is null or p_actor_id <> p_owner_id then
    raise exception 'AUDIT_ACTOR_INVALID' using errcode = '42501';
  end if;
  if p_action !~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
     or length(p_action) > 120
     or length(p_entity_type) not between 1 and 80
     or p_entity_id is null or length(p_entity_id) not between 1 and 128
     or pg_catalog.jsonb_typeof(v_metadata) <> 'object'
     or pg_catalog.pg_column_size(v_metadata) > 2048 then
    raise exception 'AUDIT_PAYLOAD_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_each(v_metadata) e
    where case e.key
      when 'amount_cents' then
        pg_catalog.jsonb_typeof(e.value) <> 'number'
        or (e.value #>> '{}') !~ '^-?(0|[1-9][0-9]{0,13})$'
      when 'settings_version' then
        pg_catalog.jsonb_typeof(e.value) <> 'number'
        or (e.value #>> '{}') !~ '^[1-9][0-9]{0,9}$'
      when 'count' then
        pg_catalog.jsonb_typeof(e.value) <> 'number'
        or (e.value #>> '{}') !~ '^(0|[1-9][0-9]{0,9})$'
      when 'version' then
        pg_catalog.jsonb_typeof(e.value) <> 'number'
        or (e.value #>> '{}') !~ '^[1-9][0-9]{0,9}$'
      when 'contract_id' then not public.is_valid_uuid_text(e.value)
      when 'project_id' then not public.is_valid_uuid_text(e.value)
      when 'client_id' then not public.is_valid_uuid_text(e.value)
      when 'lead_id' then not public.is_valid_uuid_text(e.value)
      when 'restore_id' then not public.is_valid_uuid_text(e.value)
      when 'backup_id' then
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^[0-9a-f]{64}$'
      when 'previous_status' then
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or length(e.value #>> '{}') not between 1 and 80
      when 'status' then
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or length(e.value #>> '{}') not between 1 and 80
      when 'kind' then
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or length(e.value #>> '{}') not between 1 and 40
      when 'reason_code' then
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^[a-z0-9_]{1,80}$'
      when 'payment_type' then
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^[a-z0-9_]{1,40}$'
      when 'reason' then
        -- Fixed short reason code only; callers must never pass free text/secrets.
        pg_catalog.jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^[a-z0-9_-]{1,80}$'
      else true end
  ) then
    raise exception 'AUDIT_METADATA_KEY_OR_TYPE_DENIED' using errcode = '22023';
  end if;

  insert into public.audit_events (owner_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_owner_id, p_actor_id, p_action, p_entity_type, p_entity_id, v_metadata)
  returning id into v_audit_id;
  return v_audit_id;
end;
$$;
revoke all on function public.write_audit_event(uuid,uuid,text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'AUDIT_APPEND_ONLY: update, delete e truncate sao proibidos.' using errcode = '42501';
end;
$$;
revoke all on function public.reject_audit_mutation() from public, anon, authenticated;
create trigger audit_events_reject_row_mutation
  before update or delete on public.audit_events
  for each row execute function public.reject_audit_mutation();
create trigger audit_events_reject_truncate
  before truncate on public.audit_events
  for each statement execute function public.reject_audit_mutation();

create or replace function public.audit_business_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_owner uuid;
  v_entity_id text;
  v_entity_type text := tg_table_name;
  v_action text;
  v_metadata jsonb := '{}'::jsonb;
  v_status text;
  v_previous_status text;
begin
  -- WP4 restore records one final business audit event. Skip per-row duplicates only
  -- inside that trusted RPC's transaction-local restore scope.
  if pg_catalog.current_setting('ber.restore', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then v_row := pg_catalog.to_jsonb(old);
  else v_row := pg_catalog.to_jsonb(new); end if;

  if tg_table_name = 'profiles' then v_owner := (v_row ->> 'id')::uuid;
  else v_owner := (v_row ->> 'owner_id')::uuid; end if;
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'owner_id');
  if v_owner is null or v_entity_id is null then
    raise exception 'AUDIT_OWNER_OR_ENTITY_MISSING' using errcode = '22023';
  end if;
  -- Every audited business action belongs to the row owner, including trusted RPC writes.
  -- A database role or stale JWT can never become a different actor_id.

  if tg_op = 'INSERT' then
    v_action := v_entity_type || '.created';
    if tg_table_name = 'financial_payments' then
      v_action := 'financial_payment.' || (v_row ->> 'type');
    elsif tg_table_name = 'lead_client_links' then
      v_action := 'lead_client_links.converted';
    end if;
  elsif tg_op = 'DELETE' then
    v_action := v_entity_type || '.deleted';
  else
    v_status := v_row ->> 'status';
    v_previous_status := pg_catalog.to_jsonb(old) ->> 'status';
    if v_status is distinct from v_previous_status then
      if v_status in ('cancelled','cancelado') then v_action := v_entity_type || '.cancelled';
      else v_action := v_entity_type || '.status_changed'; end if;
      v_metadata := jsonb_build_object('previous_status', v_previous_status, 'status', v_status);
    else
      v_action := v_entity_type || '.updated';
    end if;
  end if;

  if tg_table_name = 'financial_payments' then
    v_metadata := v_metadata || jsonb_build_object(
      'kind', v_row ->> 'type',
      'amount_cents', pg_catalog.round(((v_row ->> 'amount')::numeric) * 100)::bigint
    );
  elsif tg_table_name in ('financial_expenses','financial_payment_allocations','contract_installments') then
    v_metadata := v_metadata || jsonb_build_object(
      'amount_cents', pg_catalog.round(((v_row ->> 'amount')::numeric) * 100)::bigint
    );
  elsif tg_table_name = 'contracts' then
    v_metadata := v_metadata || jsonb_build_object(
      'amount_cents', pg_catalog.round(((v_row ->> 'total_value')::numeric) * 100)::bigint
    );
  elsif tg_table_name = 'projects'
       and v_row ? 'contracted_value'
       and v_row -> 'contracted_value' <> 'null'::jsonb then
    v_metadata := v_metadata || jsonb_build_object(
      'amount_cents', pg_catalog.round(((v_row ->> 'contracted_value')::numeric) * 100)::bigint
    );
  end if;

  if tg_table_name = 'user_settings' then
    v_metadata := v_metadata || jsonb_build_object(
      'settings_version', coalesce((v_row #>> '{preferences,version}')::integer, 1)
    );
  end if;

  perform public.write_audit_event(v_owner, v_owner, v_action, v_entity_type, v_entity_id, v_metadata);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_business_change() from public, anon, authenticated;

-- Every current/future-at-0013 private table with owner_id and uuid id gets the same
-- transactional audit trigger. No raw row or payload is persisted.
do $$
declare
  rec record;
begin
  for rec in
    select n.nspname || '.' || c.relname as relation
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute owner_attr on owner_attr.attrelid = c.oid and owner_attr.attname = 'owner_id'
    join pg_catalog.pg_attribute id_attr on id_attr.attrelid = c.oid and id_attr.attname = 'id'
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and owner_attr.atttypid = 'uuid'::regtype and id_attr.atttypid = 'uuid'::regtype
      and c.relname <> 'audit_events'
    order by c.relname
  loop
    execute format('drop trigger if exists audit_business_change on %s', rec.relation);
    execute format('create trigger audit_business_change after insert or update or delete on %s for each row execute function public.audit_business_change()', rec.relation);
    execute format('drop trigger if exists guard_owner_immutable on %s', rec.relation);
    execute format('create trigger guard_owner_immutable before update on %s for each row execute function public.guard_owner_immutable()', rec.relation);
  end loop;
end;
$$;

create trigger profiles_audit_change after insert or update or delete on public.profiles
  for each row execute function public.audit_business_change();
create trigger user_settings_audit_change after insert or update or delete on public.user_settings
  for each row execute function public.audit_business_change();
create trigger user_settings_guard_owner before update on public.user_settings
  for each row execute function public.guard_owner_immutable();

-- ============ PERFORMANCE INDEXES ============
create index if not exists lead_activities_owner_created_id_idx
  on public.lead_activities (owner_id, created_at desc, id desc);
create index if not exists lead_followups_owner_due_all_idx
  on public.lead_followups (owner_id, due_at, id);
create index if not exists lead_followups_owner_status_due_id_idx
  on public.lead_followups (owner_id, status, due_at, id);
create index if not exists lead_followups_owner_lead_due_id_idx
  on public.lead_followups (owner_id, lead_id, due_at, id);
create index if not exists lead_followups_owner_done_idx
  on public.lead_followups (owner_id, completed_at desc, id desc) where status = 'concluido';
create index if not exists leads_owner_created_id_idx
  on public.leads (owner_id, created_at desc, id desc);
create index if not exists leads_owner_service_idx
  on public.leads (owner_id, offered_service);
create index if not exists clients_owner_created_id_idx
  on public.clients (owner_id, created_at desc, id desc);
create index if not exists lead_client_links_owner_converted_id_idx
  on public.lead_client_links (owner_id, converted_at desc, id desc);
create index if not exists projects_owner_service_idx
  on public.projects (owner_id, service);
create index if not exists contracts_owner_service_idx
  on public.contracts (owner_id, service);

-- ============ READ-ONLY DIAGNOSTICS ADAPTER ============
-- WP4/0012 owns the complete get_backup_diagnostics() matrix.
create or replace function public.diagnose_data_integrity()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.get_backup_diagnostics();
$$;
revoke all on function public.diagnose_data_integrity() from public, anon, authenticated;
grant execute on function public.diagnose_data_integrity() to authenticated;

-- ============ STABLE CURSOR PAGINATION ============
create or replace function public.list_followups_cursor(
  p_list text,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_start timestamptz;
  v_end timestamptz;
  v_now timestamptz := now();
  v_rows jsonb;
  v_has_more boolean;
  v_last jsonb;
  v_next jsonb := null;
begin
  if p_list is null or p_list not in ('today','upcoming','overdue','done','all') then
    raise exception 'FOLLOWUP_LIST_INVALID' using errcode = '22023';
  end if;
  if (p_after_at is null) <> (p_after_id is null) then
    raise exception 'CURSOR_PAIR_INVALID' using errcode = '22023';
  end if;
  v_start := ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_end := (((now() at time zone 'America/Sao_Paulo')::date + 1)::timestamp) at time zone 'America/Sao_Paulo';

  if p_list = 'done' then
    with page as (
      select f.*, l.name as "leadName"
      from public.lead_followups f
      join public.leads l on l.id = f.lead_id and l.owner_id = f.owner_id
      where f.status = 'concluido' and f.completed_at is not null
        and (p_after_at is null or (f.completed_at, f.id) < (p_after_at, p_after_id))
      order by f.completed_at desc, f.id desc
      limit v_limit + 1
    ), numbered as (
      select p.*, row_number() over (order by p.completed_at desc, p.id desc) as rn
      from page p
    )
    select count(*) > v_limit,
           coalesce(jsonb_agg(pg_catalog.to_jsonb(p) order by p.completed_at desc, p.id desc)
                    filter (where p.rn <= v_limit), '[]'::jsonb)
      into v_has_more, v_rows from numbered p;
  else
    with page as (
      select f.*, l.name as "leadName"
      from public.lead_followups f
      join public.leads l on l.id = f.lead_id and l.owner_id = f.owner_id
      where (p_list = 'all' or (
        f.status = 'pendente'
        and ((p_list = 'today' and f.due_at >= v_start and f.due_at < v_end)
          or (p_list = 'upcoming' and f.due_at >= v_end)
          or (p_list = 'overdue' and f.due_at < v_now))
      ))
        and (p_after_at is null or (f.due_at, f.id) > (p_after_at, p_after_id))
      order by f.due_at asc, f.id asc
      limit v_limit + 1
    ), numbered as (
      select p.*, row_number() over (order by p.due_at asc, p.id asc) as rn
      from page p
    )
    select count(*) > v_limit,
           coalesce(jsonb_agg(pg_catalog.to_jsonb(p) order by p.due_at asc, p.id asc)
                    filter (where p.rn <= v_limit), '[]'::jsonb)
      into v_has_more, v_rows from numbered p;
  end if;

  if v_has_more and jsonb_array_length(v_rows) > 0 then
    v_last := v_rows -> (jsonb_array_length(v_rows) - 1);
    v_next := jsonb_build_object(
      'at', case when p_list = 'done' then v_last ->> 'completed_at' else v_last ->> 'due_at' end,
      'id', v_last ->> 'id'
    );
  end if;
  return jsonb_build_object(
    'items', v_rows,
    'nextCursor', v_next,
    'hasMore', v_has_more
  );
end;
$$;
revoke all on function public.list_followups_cursor(text,timestamptz,uuid,integer) from public, anon;
grant execute on function public.list_followups_cursor(text,timestamptz,uuid,integer) to authenticated;

create or replace function public.list_lead_followups_cursor(
  p_lead_id uuid,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_has_more boolean;
  v_last jsonb;
begin
  if p_lead_id is null then
    raise exception 'LEAD_ID_INVALID' using errcode = '22023';
  end if;
  if (p_after_at is null) <> (p_after_id is null) then
    raise exception 'CURSOR_PAIR_INVALID' using errcode = '22023';
  end if;
  with page as (
    select f.*, l.name as "leadName"
    from public.lead_followups f
    join public.leads l on l.id = f.lead_id and l.owner_id = f.owner_id
    where f.lead_id = p_lead_id
      and (p_after_at is null or (f.due_at, f.id) > (p_after_at, p_after_id))
    order by f.due_at asc, f.id asc
    limit v_limit + 1
  ), numbered as (
    select p.*, row_number() over (order by p.due_at asc, p.id asc) as rn
    from page p
  )
  select count(*) > v_limit,
         coalesce(jsonb_agg(pg_catalog.to_jsonb(p) order by p.due_at asc, p.id asc)
                  filter (where p.rn <= v_limit), '[]'::jsonb)
    into v_has_more, v_rows from numbered p;

  if v_has_more and jsonb_array_length(v_rows) > 0 then
    v_last := v_rows -> (jsonb_array_length(v_rows) - 1);
  end if;
  return jsonb_build_object(
    'items', v_rows,
    'nextCursor', case when v_has_more then jsonb_build_object('at', v_last ->> 'due_at', 'id', v_last ->> 'id') else null end,
    'hasMore', v_has_more
  );
end;
$$;
revoke all on function public.list_lead_followups_cursor(uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.list_lead_followups_cursor(uuid,timestamptz,uuid,integer) to authenticated;

create or replace function public.list_lead_activities_cursor(
  p_lead_id uuid,
  p_after_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_has_more boolean;
  v_last jsonb;
begin
  if p_lead_id is null then
    raise exception 'LEAD_ID_INVALID' using errcode = '22023';
  end if;
  if (p_after_at is null) <> (p_after_id is null) then
    raise exception 'CURSOR_PAIR_INVALID' using errcode = '22023';
  end if;
  with page as (
    select a.* from public.lead_activities a
    where a.lead_id = p_lead_id
      and (p_after_at is null or (a.created_at, a.id) < (p_after_at, p_after_id))
    order by a.created_at desc, a.id desc
    limit v_limit + 1
  ), numbered as (
    select p.*, row_number() over (order by p.created_at desc, p.id desc) as rn
    from page p
  )
  select count(*) > v_limit,
         coalesce(jsonb_agg(pg_catalog.to_jsonb(p) order by p.created_at desc, p.id desc)
                  filter (where p.rn <= v_limit), '[]'::jsonb)
    into v_has_more, v_rows from numbered p;

  if jsonb_array_length(v_rows) > 0 then
    v_last := v_rows -> (jsonb_array_length(v_rows) - 1);
  end if;
  return jsonb_build_object(
    'items', v_rows,
    'nextCursor', case when v_has_more then jsonb_build_object('at', v_last ->> 'created_at', 'id', v_last ->> 'id') else null end,
    'hasMore', v_has_more
  );
end;
$$;
revoke all on function public.list_lead_activities_cursor(uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.list_lead_activities_cursor(uuid,timestamptz,uuid,integer) to authenticated;

-- ============ SERVER DASHBOARD AGGREGATION ============
create or replace function public.get_dashboard_snapshot(p_now timestamptz default now())
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  with metrics as (
    select
      (select count(*) from public.leads) as "totalLeads",
      (select count(*) from public.leads where status = 'novo') as "novos",
      (select count(*) from public.leads where status in ('contato_realizado','aguardando_resposta','pediu_informacoes')) as "contatados",
      (select count(*) from public.leads where status = 'interessado') as "interessados",
      (select count(*) from public.leads where status = 'negociando') as "negociando",
      (select count(*) from public.lead_client_links) as "convertidos",
      (select count(*) from public.leads where needs <> '{}' and status not in ('aceitou','perdido','nao_interessado')) as "totalOportunidades",
      (select count(*) from public.leads where needs <> '{}' and status not in ('aceitou','perdido','nao_interessado') and priority in ('muito_alta','alta')) as "altaPrioridade",
      (select count(*) from public.lead_followups where status = 'pendente') as "followupsPendentes",
      (select count(*) from public.lead_followups where status = 'pendente' and due_at < v_now) as "followupsAtrasados"
  ), months as (
    select generate_series(
      date_trunc('month', v_now at time zone 'America/Sao_Paulo') - interval '5 months',
      date_trunc('month', v_now at time zone 'America/Sao_Paulo'),
      interval '1 month'
    ) as month_start
  ), by_month as (
    select m.month_start as sort_at, to_char(m.month_start, 'MM/YY') as month, count(l.id)::integer as total
    from months m
    left join public.leads l
      on l.created_at at time zone 'America/Sao_Paulo' >= m.month_start
     and l.created_at at time zone 'America/Sao_Paulo' < m.month_start + interval '1 month'
    group by m.month_start order by m.month_start
  ), by_niche as (
    select case coalesce(nullif(niche, ''), 'outros')
      when 'barbearia' then 'Barbearia' when 'manicure' then 'Manicure'
      when 'nail_designer' then 'Nail designer' when 'salao_beleza' then 'Salão de beleza'
      when 'restaurante' then 'Restaurante' when 'pizzaria' then 'Pizzaria'
      when 'hamburgueria' then 'Hambúrguer' when 'lanchonete' then 'Lanchonete'
      when 'cafeteria' then 'Cafeteria' when 'clinica_estetica' then 'Clínica estética'
      when 'comercio' then 'Pequeno comércio' when 'outros' then 'Outros'
      else coalesce(nullif(niche, ''), 'Outros') end as label,
      count(*)::integer as total
    from public.leads group by 1 order by total desc, label
  ), by_status as (
    select case status
      when 'novo' then 'Novo' when 'contato_realizado' then 'Contato realizado'
      when 'aguardando_resposta' then 'Aguardando resposta' when 'pediu_informacoes' then 'Pediu informações'
      when 'interessado' then 'Interessado' when 'negociando' then 'Negociando'
      when 'aceitou' then 'Aceitou' when 'ignorou' then 'Ignorou'
      when 'nao_interessado' then 'Não interessado' when 'follow_up' then 'Follow-up'
      when 'perdido' then 'Perdido' else status end as label,
      count(*)::integer as total
    from public.leads group by 1 order by total desc, label
  ), by_priority as (
    select case priority when 'muito_alta' then 'Muito alta' when 'alta' then 'Alta'
      when 'media' then 'Média' when 'baixa' then 'Baixa' else priority end as label,
      count(*)::integer as total
    from public.leads
    where needs <> '{}' and status not in ('aceitou','perdido','nao_interessado')
    group by 1 order by total desc, label
  ), funnel as (
    select 1 as ord, 'Novo' as label, count(*) filter (where status = 'novo')::integer as total from public.leads
    union all select 2, 'Contatado', count(*) filter (where status in ('contato_realizado','aguardando_resposta','pediu_informacoes'))::integer from public.leads
    union all select 3, 'Interessado', count(*) filter (where status = 'interessado')::integer from public.leads
    union all select 4, 'Negociando', count(*) filter (where status = 'negociando')::integer from public.leads
    union all select 5, 'Aceitou', count(*) filter (where status = 'aceitou')::integer from public.leads
  ), pending as (
    select f.due_at as sort_at, f.id as sort_id,
           pg_catalog.to_jsonb(f) || jsonb_build_object('leadName', l.name) as row
    from public.lead_followups f
    join public.leads l on l.id = f.lead_id and l.owner_id = f.owner_id
    where f.status = 'pendente'
    order by f.due_at asc, f.id asc limit 6
  ), activities as (
    select a.created_at as sort_at, a.id as sort_id,
           pg_catalog.to_jsonb(a) || jsonb_build_object('leadName', l.name) as row
    from public.lead_activities a
    join public.leads l on l.id = a.lead_id and l.owner_id = a.owner_id
    order by a.created_at desc, a.id desc limit 8
  ), status_changes as (
    select a.created_at as sort_at, a.id as sort_id,
           pg_catalog.to_jsonb(a) || jsonb_build_object('leadName', l.name) as row
    from public.lead_activities a
    join public.leads l on l.id = a.lead_id and l.owner_id = a.owner_id
    where a.type = 'mudanca_status'
    order by a.created_at desc, a.id desc limit 5
  ), recent_leads as (
    select created_at as sort_at, id as sort_id,
           jsonb_build_object('id', id, 'name', name, 'created_at', created_at) as row
    from public.leads order by created_at desc, id desc limit 5
  )
  select jsonb_build_object(
    'generatedAt', v_now,
    'indicators', (select pg_catalog.to_jsonb(m) from metrics m),
    'byMonth', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'total', total) order by sort_at) from by_month), '[]'::jsonb),
    'byNiche', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'total', total) order by total desc, label) from by_niche), '[]'::jsonb),
    'byStatus', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'total', total) order by total desc, label) from by_status), '[]'::jsonb),
    'byPriority', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'total', total) order by total desc, label) from by_priority), '[]'::jsonb),
    'funnel', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'total', total) order by ord) from funnel), '[]'::jsonb),
    'pendingFollowups', coalesce((select jsonb_agg(row order by sort_at asc, sort_id asc) from pending), '[]'::jsonb),
    'recentActivities', coalesce((select jsonb_agg(row order by sort_at desc, sort_id desc) from activities), '[]'::jsonb),
    'recentStatusChanges', coalesce((select jsonb_agg(row order by sort_at desc, sort_id desc) from status_changes), '[]'::jsonb),
    'recentLeads', coalesce((select jsonb_agg(row order by sort_at desc, sort_id desc) from recent_leads), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_dashboard_snapshot(timestamptz) from public, anon;
grant execute on function public.get_dashboard_snapshot(timestamptz) to authenticated;

commit;
```

- [ ] **Step 3: Review the generated SQL before any database execution.**

Run only static/local checks:

```bash
git diff --check
git diff -- supabase/migrations/0013_etapa3_security_audit.sql
```

Expected: no edits to `0001`–`0012`; all `security definer` functions created here have `set search_path = ''`; all objects are `public.`-qualified; all client writes to financial/history/audit tables are revoked; all private audit reads remain owner-scoped; metadata keys are allowlisted and capped; audit writer has no client EXECUTE; mandatory trigger exceptions are not caught.

- [ ] **Step 4: Verify catalog invariants with a read-only query prepared for manual execution.**

Task 4 owns `supabase/tests/etapa3_security.sql`. In this task, review the following catalog queries as part of the migration checklist; do not create a second test file or execute them remotely during plan authoring:

```sql
select p.oid::regprocedure as function_name, p.prosecdef, p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;

select c.relname, c.relrowsecurity,
       has_table_privilege('authenticated', c.oid, 'SELECT') as can_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as can_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as can_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as can_delete
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = c.oid and a.attname = 'owner_id' and not a.attisdropped
  )
order by c.relname;
```

Expected: every `security definer` function has an explicit empty `search_path`; every private table has RLS; `profiles` has no table UPDATE but has column UPDATE(`full_name`); `audit_events`, financial tables and important histories have SELECT only for `authenticated`; any extra definer function from `0010`–`0012` without empty path blocks the migration and must be fixed in its owning plan.

- [ ] **Step 5: Reconfirm restore audit compatibility without editing WP4.**

Read the final `0012` restore body and its service result type. The accepted explicit calls are exactly the canonical owner/actor pair and textual entity IDs:

```sql
-- 0012 already owns this call; 0013 must not recreate or edit it.
v_audit_id := public.write_audit_event(
  v_owner, v_owner, 'backup.restore', 'backup', v_hash,
  jsonb_build_object(
    'backup_id', v_hash,
    'restore_id', v_restore_id::text,
    'count', (v_classification -> 'totals' ->> 'new')::int
  )
);
return jsonb_build_object('inserted', v_inserted, 'audit_event_id', v_audit_id);
```

`v_hash` is the validated 64-character SHA-256 package hash and `v_restore_id` is the UUID generated by the validated restore transaction. `ber.restore = 'on'` must surround only the trusted insert loop, and the generic trigger must suppress duplicate events while that setting is on. The RPC may return `audit_event_id` as an optional extra; `src/services/backupService.ts` and `src/types/backup.ts` must accept success without requiring it. The writer raises on failure, so restore and audit commit or roll back together. If any detail differs, stop and have WP4's owner correct WP4/`0012`; this task creates only `0013` and never edits `0012`.

- [ ] **Step 6: Commit the migration only after SQL review.**

```bash
git add supabase/migrations/0013_etapa3_security_audit.sql
git commit -m "feat: adicionar seguranca auditoria e integridade"
```

Do not apply this migration remotely as part of this commit. Database execution is Task 6 and remains externally dependent without authorization.

---

### Task 4: Prove append-only auditing, rollback, grants and owner isolation in SQL

**Files:**

- Create: `supabase/tests/etapa3_security.sql`.
- Read/run but do not edit: `supabase/tests/etapa3_backup.sql` (canonical WP4 diagnostic matrix).
- Do not edit `0010`–`0012`, the WP4 audit test or the two-owner manual checklist owned by Task 6.

**Interfaces:**

- Input: a disposable/local PostgreSQL database with `0001`–`0013` applied and permission to create synthetic auth users.
- Output: transactional assertions for role protection, direct-write denial, typed audit metadata, rollback, cursor stability, diagnostic adapter equivalence/read-only behavior and two-owner SELECT isolation; the complete diagnostic category matrix is verified by the canonical WP4 suite.
- The test uses `set local role authenticated` and `request.jwt.claim.sub`; it is synthetic SQL evidence, not a substitute for the real two-user browser checklist.

- [ ] **Step 1: Write the complete transactional SQL test.**

Create `supabase/tests/etapa3_security.sql`:

```sql
-- Run only against a disposable/local database with 0001-0013 applied.
begin;

create or replace function public.etapa3_test_reject_audit_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'FORCE_AUDIT_FAILURE' using errcode = '23514';
end;
$$;

do $$
declare
  v_owner_a uuid;
  v_owner_b uuid;
  v_lead_a1 uuid;
  v_lead_a2 uuid;
  v_lead_b uuid;
  v_activity_a uuid;
  v_activity_a2 uuid;
  v_activity_a3 uuid;
  v_event uuid;
  v_metadata jsonb;
  v_bad_metadata jsonb;
  v_today timestamptz;
  v_activity_at timestamptz;
  v_package_timestamp timestamptz := '2001-02-03T04:05:06Z';
  v_due_1 timestamptz;
  v_due_2 timestamptz;
  v_page_1 jsonb;
  v_page_2 jsonb;
  v_page_3 jsonb;
  v_exact_page jsonb;
  v_cursor jsonb;
  v_snapshot jsonb;
  v_diagnostics jsonb;
  v_count bigint;
  v_audit_count bigint;
  v_original_action text;
  v_status text;
  v_restore_definition text;
begin
  insert into auth.users (id, email)
  values (gen_random_uuid(), 'etapa3-security-a@example.test')
  returning id into v_owner_a;
  insert into auth.users (id, email)
  values (gen_random_uuid(), 'etapa3-security-b@example.test')
  returning id into v_owner_b;

  if pg_catalog.to_regprocedure('public.write_audit_event(uuid,uuid,text,text,text,jsonb)') is null
     or pg_catalog.to_regprocedure('public.restore_backup(jsonb,text,text)') is null then
    raise exception 'writer canonica ou restore de 0012 ausente; aplique 0011 -> 0012 -> 0013.';
  end if;
  select pg_catalog.pg_get_functiondef('public.restore_backup(jsonb,text,text)'::regprocedure)
    into v_restore_definition;
  if strpos(v_restore_definition, 'write_audit_event') = 0
     or strpos(v_restore_definition, 'backup.restore') = 0
     or strpos(v_restore_definition, 'backup_id') = 0
     or strpos(v_restore_definition, 'restore_id') = 0
     or strpos(v_restore_definition, 'ber.restore') = 0
     or strpos(v_restore_definition, 'backup.table_restored') > 0 then
    raise exception '0012 nao contem o contrato canonico de auditoria de restore.';
  end if;

  insert into public.leads (owner_id, name, status, estimated_value)
  values (v_owner_a, 'Lead A1', 'novo', 100.00)
  returning id into v_lead_a1;
  insert into public.lead_activities (owner_id, lead_id, type, description, user_id)
  values (v_owner_a, v_lead_a1, 'observacao', 'Atividade inicial', v_owner_a)
  returning id into v_activity_a;

  select count(*) into v_count from public.audit_events where owner_id = v_owner_a;
  if v_count <> 3 then
    raise exception 'esperadas 3 auditorias iniciais do dono A (perfil, lead, atividade), encontradas %.', v_count;
  end if;

  insert into public.leads (owner_id, name, status, estimated_value)
  values (v_owner_a, 'Lead A2', 'novo', 110.00)
  returning id into v_lead_a2;
  insert into public.leads (owner_id, name, status, estimated_value)
  values (v_owner_b, 'Lead B', 'novo', 200.00)
  returning id into v_lead_b;

  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then
    raise exception 'profiles nao tem privilégio de coluna mínimo.';
  end if;
  if has_table_privilege('authenticated', 'public.audit_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_events', 'DELETE')
     or has_function_privilege('authenticated', 'public.write_audit_event(uuid,uuid,text,text,text,jsonb)', 'EXECUTE') then
    raise exception 'audit_events ou writer possui escrita direta.';
  end if;
  if has_table_privilege('authenticated', 'public.financial_payments', 'INSERT')
     or has_table_privilege('authenticated', 'public.financial_payments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.financial_payments', 'DELETE') then
    raise exception 'financial_payments possui escrita direta.';
  end if;
  if has_table_privilege('authenticated', 'public.lead_activities', 'UPDATE')
     or has_table_privilege('authenticated', 'public.lead_activities', 'DELETE') then
    raise exception 'lead_activities possui histórico mutável.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.audit_events'::regclass
      and contype = 'f' and confdeltype = 'r'
  ) then
    raise exception 'audit_events.owner_id nao usa ON DELETE RESTRICT.';
  end if;
  select pg_catalog.pg_get_triggerdef(oid) into strict v_status from pg_catalog.pg_trigger
  where tgrelid = 'public.audit_events'::regclass and tgname = 'audit_events_reject_row_mutation';
  if strpos(upper(v_status), 'FOR EACH ROW') = 0 or strpos(upper(v_status), 'UPDATE OR DELETE') = 0 then
    raise exception 'trigger de auditoria UPDATE/DELETE nao e de linha.';
  end if;
  select pg_catalog.pg_get_triggerdef(oid) into strict v_status from pg_catalog.pg_trigger
  where tgrelid = 'public.audit_events'::regclass and tgname = 'audit_events_reject_truncate';
  if strpos(upper(v_status), 'FOR EACH STATEMENT') = 0 or strpos(upper(v_status), 'TRUNCATE') = 0 then
    raise exception 'trigger de auditoria TRUNCATE nao e de statement separado.';
  end if;

  begin
    perform public.write_audit_event(
      v_owner_a, v_owner_a, 'lead.invalid', 'leads', v_lead_a1::text,
      jsonb_build_object('password', 'segredo')
    );
    raise exception 'metadado proibido foi aceito.';
  exception when invalid_parameter_value then
    if sqlerrm not like 'AUDIT_METADATA_KEY_OR_TYPE_DENIED%' then raise; end if;
  end;
  begin
    perform public.write_audit_event(
      v_owner_a, v_owner_a, 'lead.invalid', 'leads', v_lead_a1::text,
      jsonb_build_object('amount_cents', '123')
    );
    raise exception 'amount_cents textual foi aceito.';
  exception when invalid_parameter_value then
    if sqlerrm not like 'AUDIT_METADATA_KEY_OR_TYPE_DENIED%' then raise; end if;
  end;
  begin
    perform public.write_audit_event(
      v_owner_a, v_owner_b, 'lead.invalid', 'leads', v_lead_a1::text, '{}'::jsonb
    );
    raise exception 'actor diferente do owner foi aceito.';
  exception when insufficient_privilege then
    if sqlerrm not like 'AUDIT_ACTOR_INVALID%' then raise; end if;
  end;

  v_metadata := jsonb_build_object(
    'previous_status', 'novo', 'status', 'interessado', 'amount_cents', 12345,
    'kind', 'receipt', 'reason_code', 'manual_review',
    'contract_id', gen_random_uuid(), 'project_id', gen_random_uuid(),
    'client_id', gen_random_uuid(), 'lead_id', v_lead_a1,
    'restore_id', gen_random_uuid(), 'settings_version', 1, 'count', 0,
    'version', 1, 'backup_id', repeat('a', 64), 'payment_type', 'pix',
    'reason', 'manual_review'
  );
  v_event := public.write_audit_event(
    v_owner_a, v_owner_a, 'lead.metadata_validated', 'leads', v_lead_a1::text, v_metadata
  );
  if (select count(*) from jsonb_object_keys(v_metadata)) <> 16 then
    raise exception 'fixture da allowlist nao contem as 16 chaves canonicas.';
  end if;
  if v_event is null or not exists (
    select 1 from public.audit_events
    where id = v_event and owner_id = v_owner_a and actor_id = v_owner_a
      and entity_id = v_lead_a1::text and metadata = v_metadata
  ) then raise exception 'writer nao retornou UUID ou nao persistiu a allowlist exata.'; end if;

  v_event := public.write_audit_event(
    v_owner_a, v_owner_a, 'backup.restore', 'backup', repeat('b', 64),
    jsonb_build_object(
      'backup_id', repeat('b', 64),
      'restore_id', gen_random_uuid()::text,
      'count', 1
    )
  );
  if v_event is null then raise exception 'entity_id textual de backup nao foi aceito.'; end if;

  for v_bad_metadata in
    select value from jsonb_array_elements('[
      {"count":"1"}, {"settings_version":"1"}, {"version":1.5},
      {"backup_id":"not-a-sha256"}, {"reason":"free text with secret"},
      {"client_id":123}, {"amount_cents":1.5}, {"token":"secret"}
    ]'::jsonb)
  loop
    begin
      perform public.write_audit_event(
        v_owner_a, v_owner_a, 'lead.invalid', 'leads', v_lead_a1::text, v_bad_metadata
      );
      raise exception 'metadado invalido foi aceito: %', v_bad_metadata;
    exception when invalid_parameter_value then
      if sqlerrm not like 'AUDIT_METADATA_KEY_OR_TYPE_DENIED%' then raise; end if;
    end;
  end loop;

  begin
    update public.leads set owner_id = v_owner_b where id = v_lead_a1;
    raise exception 'owner_id foi alterado.';
  exception when insufficient_privilege then
    if sqlerrm not like 'OWNER_IMMUTABLE%' then raise; end if;
  end;

  select count(*) into v_audit_count from public.audit_events
  where owner_id = v_owner_a and entity_type = 'leads' and entity_id = v_lead_a1::text;
  perform set_config('ber.restore', 'on', true);
  update public.leads set name = 'Lead em restore', updated_at = v_package_timestamp where id = v_lead_a1;
  if (select updated_at from public.leads where id = v_lead_a1) <> v_package_timestamp then
    raise exception 'set_updated_at sobrescreveu o timestamp do pacote durante ber.restore.';
  end if;
  select count(*) into v_count from public.audit_events
  where owner_id = v_owner_a and entity_type = 'leads' and entity_id = v_lead_a1::text;
  if v_count <> v_audit_count then raise exception 'trigger generico duplicou auditoria durante restore.'; end if;
  perform set_config('ber.restore', 'off', true);
  update public.leads set updated_at = v_package_timestamp where id = v_lead_a1;
  if (select updated_at from public.leads where id = v_lead_a1) = v_package_timestamp then
    raise exception 'set_updated_at nao atualizou uma operacao normal.';
  end if;
  select count(*) into v_count from public.audit_events
  where owner_id = v_owner_a and entity_type = 'leads' and entity_id = v_lead_a1::text;
  if v_count <> v_audit_count + 1 then raise exception 'auditoria generica normal ausente.'; end if;

  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
  set local role authenticated;

  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'autoedicao de role foi aceita.';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.lead_activities set description = 'adulterado' where id = v_activity_a;
    raise exception 'update de história foi aceito.';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.audit_events (owner_id, actor_id, action, entity_type, entity_id)
    values (auth.uid(), auth.uid(), 'lead.fake', 'leads', v_lead_a1::text);
    raise exception 'insert direto em audit_events foi aceito.';
  exception when insufficient_privilege then null;
  end;

  select count(*) into v_count from public.leads;
  if v_count <> 2 then raise exception 'RLS de leads vazou o segundo proprietario.'; end if;
  if exists (select 1 from public.audit_events where owner_id <> auth.uid()) then
    raise exception 'SELECT de audit_events vazou o segundo proprietario.';
  end if;

  update public.leads set status = 'interessado' where id = v_lead_a1;
  select count(*) into v_count from public.audit_events
  where owner_id = auth.uid() and entity_type = 'leads' and entity_id = v_lead_a1::text
    and action = 'leads.status_changed'
    and metadata ->> 'previous_status' = 'novo' and metadata ->> 'status' = 'interessado';
  if v_count <> 1 then raise exception 'auditoria de status nao foi gravada.'; end if;
  if exists (
    select 1 from public.audit_events
    where metadata ?| array['password','token','access_token','refresh_token','payload','raw','service_role']
  ) then
    raise exception 'auditoria contem metadado proibido.';
  end if;

  begin
    insert into public.lead_activities (owner_id, lead_id, type, description, user_id)
    values (auth.uid(), v_lead_b, 'observacao', 'Cross-owner', auth.uid());
    raise exception 'escrita cross-owner foi aceita.';
  exception when insufficient_privilege then null;
  when foreign_key_violation then null;
  end;

  v_today := ((now() at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_due_1 := v_today + interval '9 hours';
  v_due_2 := v_today + interval '10 hours';
  insert into public.lead_followups (owner_id, lead_id, due_at, status)
  values
    (auth.uid(), v_lead_a1, v_due_1, 'pendente'),
    (auth.uid(), v_lead_a1, v_due_2, 'pendente'),
    (auth.uid(), v_lead_a2, v_due_2, 'pendente');
  select created_at into v_activity_at from public.lead_activities where id = v_activity_a;
  insert into public.lead_activities (owner_id, lead_id, type, description, user_id, created_at)
  values (auth.uid(), v_lead_a1, 'observacao', 'Atividade A2', auth.uid(), v_activity_at)
  returning id into v_activity_a2;
  insert into public.lead_activities (owner_id, lead_id, type, description, user_id, created_at)
  values (auth.uid(), v_lead_a1, 'observacao', 'Atividade A3', auth.uid(), v_activity_at)
  returning id into v_activity_a3;

  v_page_1 := public.list_followups_cursor('all', null, null, 1);
  if (v_page_1 -> 'hasMore') <> 'true'::jsonb
     or (v_page_1 -> 'nextCursor') is null then
    raise exception 'primeira pagina all nao sinalizou continuidade.';
  end if;
  v_cursor := v_page_1 -> 'nextCursor';
  v_page_2 := public.list_followups_cursor(
    'all', (v_cursor ->> 'at')::timestamptz, (v_cursor ->> 'id')::uuid, 1
  );
  if (v_page_2 -> 'hasMore') <> 'true'::jsonb then
    raise exception 'segunda pagina all nao sinalizou continuidade.';
  end if;
  v_cursor := v_page_2 -> 'nextCursor';
  v_page_3 := public.list_followups_cursor(
    'all', (v_cursor ->> 'at')::timestamptz, (v_cursor ->> 'id')::uuid, 1
  );
  if (v_page_3 -> 'hasMore') <> 'false'::jsonb
     or (v_page_3 -> 'nextCursor') <> 'null'::jsonb
     or jsonb_array_length(v_page_3 -> 'items') <> 1 then
    raise exception 'terceira pagina all nao encerrou corretamente.';
  end if;
  if (v_page_1 -> 'items' -> 0 ->> 'id') = (v_page_2 -> 'items' -> 0 ->> 'id')
     or (v_page_2 -> 'items' -> 0 ->> 'id') = (v_page_3 -> 'items' -> 0 ->> 'id')
     or (v_page_2 -> 'items' -> 0 ->> 'due_at') <> (v_page_3 -> 'items' -> 0 ->> 'due_at') then
    raise exception 'cursor nao desambiguou dois due_at iguais por id.';
  end if;
  if (v_page_2 -> 'nextCursor' ->> 'at') <> (v_page_2 -> 'items' -> 0 ->> 'due_at')
     or (v_page_2 -> 'nextCursor' ->> 'id') <> (v_page_2 -> 'items' -> 0 ->> 'id') then
    raise exception 'cursor nao aponta para a ultima linha visivel.';
  end if;

  v_exact_page := public.list_followups_cursor('all', null, null, 3);
  if (v_exact_page -> 'hasMore') <> 'false'::jsonb
     or (v_exact_page -> 'nextCursor') <> 'null'::jsonb
     or jsonb_array_length(v_exact_page -> 'items') <> 3 then
    raise exception 'limite exato foi tratado como pagina com continuidade.';
  end if;
  v_exact_page := public.list_followups_cursor('all', null, null, 2);
  if (v_exact_page -> 'hasMore') <> 'true'::jsonb
     or jsonb_array_length(v_exact_page -> 'items') <> 2 then
    raise exception 'limit + 1 nao sinalizou a linha extra.';
  end if;

  v_page_1 := public.list_lead_followups_cursor(v_lead_a1, null, null, 1);
  v_cursor := v_page_1 -> 'nextCursor';
  v_page_2 := public.list_lead_followups_cursor(v_lead_a1, (v_cursor ->> 'at')::timestamptz, (v_cursor ->> 'id')::uuid, 1);
  if (v_page_1 -> 'hasMore') <> 'true'::jsonb or (v_page_2 -> 'hasMore') <> 'false'::jsonb
     or jsonb_array_length(v_page_1 -> 'items') <> 1 or jsonb_array_length(v_page_2 -> 'items') <> 1
     or (v_page_1 -> 'items' -> 0 ->> 'id') = (v_page_2 -> 'items' -> 0 ->> 'id') then
    raise exception 'listByLead paginado saltou ou repetiu follow-up.';
  end if;

  v_page_1 := public.list_lead_activities_cursor(v_lead_a1, null, null, 2);
  v_cursor := v_page_1 -> 'nextCursor';
  v_page_2 := public.list_lead_activities_cursor(v_lead_a1, (v_cursor ->> 'at')::timestamptz, (v_cursor ->> 'id')::uuid, 2);
  if (v_page_1 -> 'hasMore') <> 'true'::jsonb or (v_page_2 -> 'hasMore') <> 'false'::jsonb
     or jsonb_array_length(v_page_1 -> 'items') <> 2 or jsonb_array_length(v_page_2 -> 'items') <> 1
     or (v_cursor ->> 'at') <> (v_page_1 -> 'items' -> 1 ->> 'created_at')
     or (v_cursor ->> 'id') <> (v_page_1 -> 'items' -> 1 ->> 'id') then
    raise exception 'pagina de atividades nao desambiguou empate por id.';
  end if;
  if (v_page_1 -> 'items' -> 0 ->> 'id') = (v_page_2 -> 'items' -> 0 ->> 'id') then
    raise exception 'pagina de atividades repetiu registro no empate.';
  end if;

  begin
    perform public.list_followups_cursor('all', v_due_2, null, 1);
    raise exception 'cursor incompleto foi aceito.';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.list_lead_activities_cursor(null::uuid, null, null, 1);
    raise exception 'lead_id nulo foi aceito.';
  exception when invalid_parameter_value then null;
  end;
  v_exact_page := public.list_followups_cursor('all', v_today + interval '30 days', gen_random_uuid(), 2);
  if (v_exact_page -> 'hasMore') <> 'false'::jsonb
     or (v_exact_page -> 'nextCursor') <> 'null'::jsonb
     or jsonb_array_length(v_exact_page -> 'items') <> 0 then
    raise exception 'cursor sem resultados nao encerrou com pagina vazia.';
  end if;

  v_snapshot := public.get_dashboard_snapshot(now());
  if (v_snapshot #>> '{indicators,totalLeads}') <> '2'
     or (v_snapshot #>> '{indicators,convertidos}') <> '0' then
    raise exception 'snapshot do dashboard nao respeitou RLS ou conversoes.';
  end if;
  v_diagnostics := public.diagnose_data_integrity();
  if v_diagnostics ->> 'schema_version' <> '3'
     or jsonb_typeof(v_diagnostics -> 'checks') <> 'array'
     or jsonb_typeof(v_diagnostics -> 'limits') <> 'object'
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(v_diagnostics -> 'checks') as check_item(value)
       where (check_item.value ->> 'count')::bigint <> 0
     ) then
    raise exception 'diagnostico encontrou problema nos dados validos de teste.';
  end if;

  reset role;

  select id, action into v_event, v_original_action from public.audit_events where owner_id = v_owner_a limit 1;
  begin
    update public.audit_events set action = 'lead.fake' where id = v_event;
    raise exception 'trigger append-only nao bloqueou UPDATE.';
  exception when insufficient_privilege then
    if sqlerrm not like 'AUDIT_APPEND_ONLY%' then raise; end if;
  end;
  if not exists (select 1 from public.audit_events where id = v_event and action = v_original_action) then
    raise exception 'UPDATE append-only alterou ou removeu a linha original.';
  end if;
  begin
    delete from public.audit_events where id = v_event;
    raise exception 'trigger append-only nao bloqueou DELETE.';
  exception when insufficient_privilege then
    if sqlerrm not like 'AUDIT_APPEND_ONLY%' then raise; end if;
  end;
  if not exists (select 1 from public.audit_events where id = v_event and action = v_original_action) then
    raise exception 'DELETE append-only removeu a linha original.';
  end if;
  begin
    truncate table public.audit_events;
    raise exception 'trigger append-only nao bloqueou TRUNCATE.';
  exception when insufficient_privilege then
    if sqlerrm not like 'AUDIT_APPEND_ONLY%' then raise; end if;
  end;
  if not exists (select 1 from public.audit_events where id = v_event and action = v_original_action) then
    raise exception 'TRUNCATE append-only removeu a linha original.';
  end if;

  create trigger etapa3_test_reject_audit_insert
  before insert on public.audit_events
  for each row execute function public.etapa3_test_reject_audit_insert();

  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
  set local role authenticated;
  select status into v_status from public.leads where id = v_lead_a1;
  begin
    update public.leads set status = 'negociando' where id = v_lead_a1;
    raise exception 'a falha de auditoria nao foi provocada.';
  exception when check_violation then
    if sqlerrm <> 'FORCE_AUDIT_FAILURE' then raise; end if;
  end;
  reset role;

  if (select status from public.leads where id = v_lead_a1) <> v_status then
    raise exception 'a operacao principal nao reverteu junto com a auditoria.';
  end if;
end;
$$;

drop trigger if exists etapa3_test_reject_audit_insert on public.audit_events;
drop function if exists public.etapa3_test_reject_audit_insert();

-- Representative adapter/isolation fixture. The complete diagnostic matrix,
-- including financial refund/allocation corruption, belongs to the canonical
-- WP4 test supabase/tests/etapa3_backup.sql and runs before this file.
do $$
declare
  v_owner_a uuid;
  v_owner_b uuid;
  v_lead_a1 uuid;
  v_lead_a2 uuid;
  v_lead_b uuid;
  v_orphan_activity uuid;
  v_required_code text;
  v_diagnostics jsonb;
  v_canonical jsonb;
  v_other_diagnostics jsonb;
  v_count bigint;
begin
  insert into auth.users (id, email) values (gen_random_uuid(), 'etapa3-diag-a@example.test') returning id into v_owner_a;
  insert into auth.users (id, email) values (gen_random_uuid(), 'etapa3-diag-b@example.test') returning id into v_owner_b;
  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
  insert into public.leads (owner_id, name, status, estimated_value, phone) values
    (v_owner_a, 'Diag A1', 'novo', 10, '11999999999'),
    (v_owner_a, 'Diag A2', 'novo', 20, '11999999999'),
    (v_owner_b, 'Diag B', 'novo', 30, '11888888888');
  select id into v_lead_a1 from public.leads where owner_id = v_owner_a and name = 'Diag A1';
  select id into v_lead_a2 from public.leads where owner_id = v_owner_a and name = 'Diag A2';
  select id into v_lead_b from public.leads where owner_id = v_owner_b and name = 'Diag B';

  alter table public.leads drop constraint if exists leads_status_check;
  alter table public.user_settings drop constraint if exists user_settings_prices_check;
  alter table public.user_settings drop constraint if exists user_settings_service_prices_check;
  update public.leads set estimated_value = -1, status = 'invalid', maps_url = 'javascript:alert(1)'
    where id = v_lead_a1;
  update public.user_settings set service_prices = '{"site":-1}' where owner_id = v_owner_a;
  if not found then
    insert into public.user_settings (owner_id, service_prices) values (v_owner_a, '{"site":-1}');
  end if;

  set local session_replication_role = replica;
  insert into public.lead_activities (id, owner_id, lead_id, type, description, user_id)
  values (gen_random_uuid(), v_owner_a, gen_random_uuid(), 'observacao', 'Orfa', v_owner_a)
  returning id into v_orphan_activity;
  set local session_replication_role = origin;
  alter table public.leads disable row level security;

  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
  set local role authenticated;
  v_diagnostics := public.diagnose_data_integrity();
  v_canonical := public.get_backup_diagnostics();
  if v_diagnostics ->> 'schema_version' <> '3'
     or jsonb_typeof(v_diagnostics -> 'checks') <> 'array'
     or jsonb_typeof(v_diagnostics -> 'limits') <> 'object'
     or v_diagnostics - 'generated_at' is distinct from v_canonical - 'generated_at'
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(v_diagnostics -> 'checks') as check_item(value)
       where (check_item.value ->> 'count')::bigint > 0
     ) then
    raise exception 'adaptador de diagnostico divergiu do dono canonico ou quebrou o contrato JSON.';
  end if;

  foreach v_required_code in array array[
    'rls.disabled',
    'orphan.lead_activities.lead_id',
    'duplicate.leads.contact',
    'invalid.service_prices',
    'invalid.maps_url',
    'invalid.lead_values',
    'invalid.statuses'
  ] loop
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements(v_diagnostics -> 'checks') as check_item(value)
      where check_item.value ->> 'code' = v_required_code
        and (check_item.value ->> 'count')::bigint > 0
    ) then
      raise exception 'fixture nao acionou o check canonico %.', v_required_code;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_diagnostics -> 'checks') as check_item(value)
    where check_item.value ->> 'code' = 'orphan.lead_activities.lead_id'
      and check_item.value -> 'sample_ids' @> jsonb_build_array(v_orphan_activity::text)
  ) then
    raise exception 'diagnostico nao incluiu a atividade orfa sintetica.';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_diagnostics -> 'checks') as check_item(value)
    cross join lateral pg_catalog.jsonb_array_elements_text(check_item.value -> 'sample_ids') as sample(value)
    where (check_item.value ->> 'count')::bigint > 0
      and sample.value = v_lead_b::text
  ) then
    raise exception 'diagnostico vazou a lead do proprietario B em sample_ids.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_b::text, true);
  v_other_diagnostics := public.diagnose_data_integrity();
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_other_diagnostics -> 'checks') as check_item(value)
    cross join lateral pg_catalog.jsonb_array_elements_text(check_item.value -> 'sample_ids') as sample(value)
    where sample.value in (v_lead_a1::text, v_lead_a2::text, v_orphan_activity::text)
  ) then
    raise exception 'diagnostico do proprietario B vazou dados do proprietario A.';
  end if;

  reset role;
  select count(*) into v_count from public.leads where owner_id = v_owner_a;
  if v_count <> 2 then raise exception 'diagnostico alterou ou removeu leads do proprietario A.'; end if;
end;
$$;

rollback;
```

- [ ] **Step 2: Statically review the test before any database run.**

```bash
git diff --check
if grep -nE '00000000-0000-0000-0000-0000000000(b01|c0)' supabase/tests/etapa3_security.sql; then
  exit 1
fi
test "$(grep -c '^rollback;' supabase/tests/etapa3_security.sql)" -eq 1
```

Expected: no nonexistent fixture UUID, exactly one terminal `rollback;`, generated synthetic users/IDs, dynamic São Paulo date arithmetic, the exact 16-key metadata fixture, textual backup entity ID, separate row/statement trigger definitions, three cursor pages plus exact/limit+1/tie/invalid-cursor cases, restore timestamp and duplicate-audit guards, owner-level UPDATE/DELETE/TRUNCATE probes preserving the original row, forced audit rollback, and a representative diagnostic fixture that proves adapter equivalence plus two-owner isolation. The complete diagnostic category matrix remains owned by `supabase/tests/etapa3_backup.sql`; this file does not duplicate or claim that matrix. Constraint changes exist only inside the rolled-back diagnostic transaction. This is a static check only.

- [ ] **Step 3: Run locally only when a disposable database is available.**

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_backup.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_security.sql
```

Expected: the canonical WP4 suite passes first and proves the complete diagnostic matrix, including `invalid.refund_allocation`; the security suite then passes its audit, cursor, adapter-equivalence and two-owner assertions. Each file ends with `rollback;` and leaves no test data. These synthetic transactions do not prove real Supabase Auth/RLS runtime behavior; Task 6 requires two actual authenticated owners for that classification. Never put `TEST_DATABASE_URL` in CI or a public workflow.

- [ ] **Step 4: Commit the test.**

```bash
git add supabase/tests/etapa3_security.sql
git commit -m "test: provar auditoria append-only e isolamento sintetico"
```

---

### Task 5: Reconcile Backup diagnostics and optional restore audit result

**Files:**

- Modify: `src/services/backupService.ts`
- Modify: `src/services/backupService.test.ts`
- Modify: `src/types/backup.ts`
- Modify: `src/pages/BackupPage.tsx` only to filter zero-count checks from the problem list.
- Test: `src/pages/BackupPage.test.tsx`
- Do not create `integrityService.ts`, `IntegrityDiagnostics.tsx` or a second diagnostics UI.

**Interfaces consumed and preserved:**

```ts
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
  auditEventId?: string
}

getDiagnostics(): Promise<BackupDiagnostics>
restoreBackup(pkg: BackupPackage, previewHash: string): Promise<RestoreResult>
```

`getDiagnostics()` calls `diagnose_data_integrity`, not `get_backup_diagnostics`; both return the same canonical JSON contract. Zero-count checks remain available to the service, but `BackupPage` must render only `count > 0` as problems. `restoreBackup()` requires a valid `inserted` map and accepts an absent, null or valid UUID `audit_event_id`; when present and valid it exposes optional `auditEventId`.

- [ ] **Step 1: Add failing contract tests to the existing Backup service suite.**

Append these tests inside the existing `describe('backupService', ...)` in `src/services/backupService.test.ts`. Keep the existing `getUser`, `rpc`, `canonicalPackage()` and `BACKUP_LIMITS` fixtures.

```ts
it('usa o adaptador canonico de diagnostico e preserva o contrato do Backup', async () => {
  const limits = { rows: 50_000, zipBytes: 26_214_400, uncompressedBytes: 52_428_800,
    rpcBytes: 4_194_304, fieldBytes: 1_048_576, files: 32, columns: 64 }
  rpc.mockResolvedValueOnce({ data: {
    generated_at: '2026-11-27T12:00:00Z', schema_version: 3,
    checks: [
      { code: 'rls.disabled', severity: 'info', count: 0, sample_ids: [] },
      { code: 'orphan.lead_activities.lead_id', severity: 'critical', count: 1,
        sample_ids: ['lead_activities:22222222-2222-4222-8222-222222222222'] },
    ],
    limits,
  }, error: null })

  await expect(getDiagnostics()).resolves.toEqual({
    generatedAt: '2026-11-27T12:00:00Z', schemaVersion: 3,
    checks: [
      { code: 'rls.disabled', severity: 'info', count: 0, sampleIds: [] },
      { code: 'orphan.lead_activities.lead_id', severity: 'critical', count: 1,
        sampleIds: ['lead_activities:22222222-2222-4222-8222-222222222222'] },
    ],
    limits,
  })
  expect(rpc).toHaveBeenCalledWith('diagnose_data_integrity')
})

it('rejeita diagnostico malformado e sessao ausente sem fingir resultado limpo', async () => {
  rpc.mockResolvedValueOnce({ data: { generated_at: 'now', schema_version: 3,
    checks: [{ code: 'orphan.leads', severity: 'important', count: 1, sample_ids: [] }],
    limits: {} }, error: null })
  await expect(getDiagnostics()).rejects.toThrow('Diagnóstico inválido.')

  getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  await expect(getDiagnostics()).rejects.toThrow('Sua sessão expirou')
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('aceita restore sem audit_event_id e preserva um UUID opcional valido', async () => {
  const pkg = await canonicalPackage()
  rpc.mockResolvedValueOnce({ data: { inserted: { leads: 1 } }, error: null })
  await expect(restoreBackup(pkg, previewHash)).resolves.toEqual({ inserted: { leads: 1 } })

  const auditId = '33333333-3333-4333-8333-333333333333'
  rpc.mockResolvedValueOnce({ data: { inserted: { leads: 1 }, audit_event_id: auditId }, error: null })
  await expect(restoreBackup(pkg, previewHash)).resolves.toEqual({ inserted: { leads: 1 }, auditEventId: auditId })

  rpc.mockResolvedValueOnce({ data: { inserted: { leads: 1 }, audit_event_id: null }, error: null })
  await expect(restoreBackup(pkg, previewHash)).resolves.toEqual({ inserted: { leads: 1 } })
})

it('rejeita inserted invalido e audit_event_id divergente no restore', async () => {
  const pkg = await canonicalPackage()
  rpc.mockResolvedValueOnce({ data: { inserted: { leads: -1 } }, error: null })
  await expect(restoreBackup(pkg, previewHash)).rejects.toThrow('Resposta de restore inválida.')

  rpc.mockResolvedValueOnce({ data: { inserted: { leads: 1 }, audit_event_id: 'not-a-uuid' }, error: null })
  await expect(restoreBackup(pkg, previewHash)).rejects.toThrow('Resposta de restore inválida.')
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/services/backupService.test.ts
```

Expected RED: `getDiagnostics()` still calls `get_backup_diagnostics`, and `restoreBackup()` still rejects an absent `audit_event_id`.

- [ ] **Step 2: Update the shared result type.**

In `src/types/backup.ts`, replace the required audit field with the optional contract:

```ts
export interface RestoreResult {
  inserted: Record<string, number>
  auditEventId?: string
}
```

Do not weaken `BackupDiagnostics`, `BackupDiagnosticCheck` or package validation.

- [ ] **Step 3: Reconcile the existing Backup service.**

In `src/services/backupService.ts`, replace only `restoreBackup()` and `getDiagnostics()` with:

```ts
export async function restoreBackup(pkg: BackupPackage, previewHash: string): Promise<RestoreResult> {
  checkPackageSize(pkg)
  if (!/^[0-9a-f]{64}$/.test(previewHash)) throw new Error('Hash de prévia inválido.')
  const { data, error } = await requireSupabase().rpc('restore_backup', {
    p_package: pkg, p_preview_hash: previewHash, p_confirmation: 'RESTAURAR',
  })
  throwDbError(error)
  const row = objectData<{ inserted: unknown; audit_event_id?: unknown }>(data, 'Resposta de restore inválida.')
  const inserted = row.inserted
  const validInserted = inserted !== null && typeof inserted === 'object' && !Array.isArray(inserted)
    && Object.values(inserted).every((count) => Number.isSafeInteger(count) && Number(count) >= 0)
  const auditId = row.audit_event_id
  const validAuditId = auditId === undefined || auditId === null
    || (typeof auditId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auditId))
  if (!validInserted || !validAuditId) throw new Error('Resposta de restore inválida.')
  return {
    inserted: inserted as Record<string, number>,
    ...(typeof auditId === 'string' ? { auditEventId: auditId } : {}),
  }
}

export async function getDiagnostics(): Promise<BackupDiagnostics> {
  await ownerId()
  const { data, error } = await requireSupabase().rpc('diagnose_data_integrity')
  throwDbError(error)
  const row = objectData<{
    generated_at: string; schema_version: number;
    checks: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; count: number; sample_ids: string[] }>;
    limits: BackupDiagnostics['limits'];
  }>(data, 'Diagnóstico inválido.')
  if (typeof row.generated_at !== 'string' || row.schema_version !== 3
    || !Array.isArray(row.checks) || !row.limits || typeof row.limits !== 'object'
    || Object.keys(row.limits).sort().join(',') !== ['columns', 'fieldBytes', 'files', 'rows', 'rpcBytes', 'uncompressedBytes', 'zipBytes'].sort().join(',')
    || !Object.values(row.limits).every((limit) => Number.isSafeInteger(limit) && limit > 0)
    || row.checks.some((check) => !check || typeof check.code !== 'string'
      || !['info', 'warning', 'critical'].includes(check.severity)
      || !Number.isSafeInteger(check.count) || check.count < 0 || !Array.isArray(check.sample_ids)
      || check.sample_ids.some((id) => typeof id !== 'string'))) {
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

The limits key check is intentionally exact. `BackupPage` continues to own loading, errors, samples and read-only presentation; do not add another component or another diagnostics state store.

- [ ] **Step 4: Add the failing zero-count UI regression to the existing Backup page suite.**

Append this test inside the existing `describe('BackupPage', ...)` in `src/pages/BackupPage.test.tsx`. It reuses the canonical `diagnostics` fixture with positive `rls.disabled` and zero-count `invalid.maps_url`; do not create another page or component.

```tsx
it('nao apresenta check zero como problema e preserva amostras textuais do check positivo', async () => {
  render(<BackupPage />)

  expect((await screen.findByText(/^rls\.disabled/)).textContent).toContain('critical')
  expect(screen.getByText('Amostras: leads').textContent).toBe('Amostras: leads')
  expect(screen.queryByText(/^invalid\.maps_url/)).toBeNull()
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/pages/BackupPage.test.tsx
```

Expected RED: the WP4 page still renders every check, including `invalid.maps_url` with count zero.

- [ ] **Step 5: Filter zero-count checks in the existing page and verify GREEN.**

In `src/pages/BackupPage.tsx`, replace only the diagnostic list expression:

```tsx
{diagnostics.checks.map((check) => (
```

with:

```tsx
{diagnostics.checks.filter((check) => check.count > 0).map((check) => (
```

Keep the service payload unchanged: zero-count checks remain available to `BackupDiagnostics` consumers and are not deleted or rewritten. Run:

```bash
npm test -- --maxWorkers=2 src/services/backupService.test.ts src/pages/BackupPage.test.tsx
```

Expected GREEN: service contract tests pass, the positive check renders with its code/severity/textual sample, and the zero-count check is absent from the problem list.

- [ ] **Step 6: Commit the scoped reconciliation.**

```bash
git diff --check
git add src/services/backupService.ts src/services/backupService.test.ts src/types/backup.ts src/pages/BackupPage.tsx src/pages/BackupPage.test.tsx
git commit -m "fix: alinhar diagnostico e resultado opcional de auditoria"
```

---

### Task 6: Prepare real two-owner runtime evidence and classify external validation

**Files:**

- Create: `supabase/tests/etapa3_two_owners_manual.sql`
- Modify: `src/pages/StatusPage.tsx` only if the checklist link/text needs a precise external-dependency label.

**Interfaces:**

- Two real Supabase Auth users A and B, no service role in browser.
- One disposable record per owner in each critical domain.
- A/B browser profiles or two private windows with independent sessions.
- Evidence matrix with expected and observed results, timestamp and tester.

- [ ] **Step 1: Write the manual SQL probe.**

Create `supabase/tests/etapa3_two_owners_manual.sql`:

```sql
-- Manual authenticated probe. Supply real test-user UUIDs at execution time:
-- psql "$TEST_DATABASE_URL" -v owner_a="$OWNER_A_UUID" -v owner_b="$OWNER_B_UUID" \
--   -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_two_owners_manual.sql
-- Run as database owner only to create fixtures; never expose this connection in the browser.
\if :{?owner_a}
\else
  \echo 'owner_a is required'
  \quit 2
\endif
\if :{?owner_b}
\else
  \echo 'owner_b is required'
  \quit 2
\endif
begin;

insert into public.leads (owner_id, name, status, estimated_value)
values (:'owner_a'::uuid, 'Probe A', 'novo', 10.00)
returning id as lead_a_id
\gset

insert into public.leads (owner_id, name, status, estimated_value)
values (:'owner_b'::uuid, 'Probe B', 'novo', 20.00)
returning id as lead_b_id
\gset

commit;

-- In separate authenticated sessions, request these through the browser/PostgREST client:
-- Session A: select * from leads; expect only owner-A rows, including :lead_a_id.
-- Session B: select * from leads; expect only owner-B rows, including :lead_b_id.
-- Session A: update leads set status='interessado' where id=:lead_b_id; expect zero rows.
-- Session B: update leads set status='interessado' where id=:lead_a_id; expect zero rows.
-- Session A: select * from audit_events; expect only owner-A events.
-- Session B: select * from audit_events; expect only owner-B events.
-- Session A: insert lead_activities with lead_id=:lead_b_id and owner_id=A; expect RLS privilege or FK error.
-- Session A: update profiles set role='admin'; expect privilege error.
-- Session A: update financial_payments set amount=1; expect privilege error.
-- Session A: delete from lead_activities; expect privilege error.
-- Session A: delete from audit_events; expect privilege error.
-- Session A: select diagnose_data_integrity(); expect no owner-B entity IDs.

-- Cleanup as database owner, with backup/confirmation and the audit retention policy:
-- delete from public.leads where id in (:'lead_a_id'::uuid, :'lead_b_id'::uuid);
-- Audit events remain append-only and must not be deleted by the test operator.
```

- [ ] **Step 2: Execute the real browser checklist only with authorization.**

1. Create users A and B in Supabase Auth; confirm email according to project settings.
2. Apply `0001`–`0013` through the authorized migration process and record the migration versions.
3. Open two isolated browser profiles. Sign in as A in one and B in the other.
4. In A create a lead, client, project task, contract/payment/expense through the UI. In B create separate records.
5. Reload both browsers, sign out/in, and confirm each session persists only its own data.
6. Run every SQL probe assertion above through the authenticated browser client, not the SQL Editor owner role.
7. Request recovery in A, open the emailed link, set a new password, and confirm the old password fails and the new password works.
8. Expire/revoke A's refresh token in Supabase Auth, wait for the configured check/refresh, and confirm A returns to login without exposing token details.
9. Attempt direct REST writes to `audit_events`, financial tables and important histories; all must be denied.
10. Record the result of each row as `PASSOU`, `FALHOU` or `NÃO EXECUTADO`, with UTC timestamp and screenshots/log references containing no secrets.

- [ ] **Step 3: Prepare performance evidence without claiming measurements.**

For each query pattern below, run `EXPLAIN (ANALYZE, BUFFERS)` only against an authorized disposable dataset with at least 10,000 leads per owner, 5,000 follow-ups and 1,000 financial movements. Record actual milliseconds and whether the expected index appears:

```sql
explain (analyze, buffers)
select * from public.leads
where owner_id = auth.uid() and status = 'negociando'
order by created_at desc, id desc limit 50;

explain (analyze, buffers)
select * from public.lead_followups
where owner_id = auth.uid() and status = 'pendente' and due_at < now()
order by due_at asc, id asc limit 50;

explain (analyze, buffers)
select public.get_dashboard_snapshot(now());

explain (analyze, buffers)
select * from public.diagnose_data_integrity();
```

Expected static plan: indexes are usable for owner/status/date/tie-break access; no sequential scan is accepted without a documented small-table reason. Do not invent latency targets. A performance number is reportable only with dataset size, hardware/region, command and fresh output.

- [ ] **Step 4: Classify evidence honestly.**

- If Task 4 ran only with synthetic JWT claims: RLS runtime remains `dependente de configuração externa`.
- If the real A/B checklist ran completely: classify RLS runtime as `concluída/testada` and attach evidence.
- If migrations were not applied remotely: migration/RLS/persistence are `dependententes de configuração externa` in the final report; never `concluída/testada`.
- If any cross-owner read/write succeeds: stop, classify security as Bloqueio Crítico and do not declare finalization.

- [ ] **Step 5: Commit the probe.**

```bash
git add supabase/tests/etapa3_two_owners_manual.sql
git commit -m "test: preparar prova runtime com dois proprietarios"
```

---

### Task 7: Move dashboard aggregation to the server and add bounded cursor/lazy loading

**Files:**

- Modify: `src/services/dashboardService.ts`
- Modify: `src/services/dashboardService.test.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Create: `src/components/dashboard/DashboardCharts.tsx`
- Create: `src/lib/cursorPagination.ts`
- Create: `src/lib/cursorPagination.test.ts`
- Modify: `src/services/followupService.ts`
- Modify: `src/services/followupService.test.ts`
- Create: `src/services/cursorPagination.test.ts`
- Modify: `src/pages/FollowUpsPage.tsx`
- Modify: `src/pages/FollowUpsPage.test.tsx`
- Create: `src/pages/FollowUpsPage.pagination.test.tsx`
- Modify: `src/services/activityService.ts`
- Modify: `src/services/activityService.test.ts`
- Modify: `src/components/leads/LeadTimeline.tsx`
- Modify: `src/components/leads/LeadTimeline.test.tsx`
- Create: `src/components/leads/LeadTimeline.pagination.test.tsx`
- Modify: `src/components/followups/FollowupItem.tsx`
- Modify: `src/components/followups/FollowupItem.test.tsx`
- Modify: `src/components/leads/LeadFollowups.tsx`
- Modify: `src/components/leads/LeadFollowups.test.tsx`
- Modify: `src/components/leads/LeadFollowups.leadName.test.tsx`
- Create: `src/components/leads/LeadFollowups.pagination.test.tsx`
- Modify: `src/pages/LeadDetailPage.conversion.test.tsx` to use the paginated activity/follow-up mocks.
- Modify: `src/pages/OpportunitiesPage.tsx`
- Modify: `src/pages/OpportunitiesPage.test.tsx`
- Modify: `src/pages/PipelinePage.test.tsx` only to remove the obsolete `listActivities` mock.
- Modify: `src/routes/AppRoutes.tsx`
- Modify: `src/routes/AppRoutes.test.tsx`

**Interfaces:**

```ts
interface DashboardData {
  generatedAt: string
  indicators: DashboardIndicators
  byMonth: Array<{ month: string; total: number }>
  byNiche: ChartDatum[]
  byStatus: ChartDatum[]
  byPriority: ChartDatum[]
  funnel: ChartDatum[]
  pendingFollowups: Array<Followup & { leadName: string }>
  recentActivities: Array<Activity & { leadName: string }>
  recentStatusChanges: Array<Activity & { leadName: string }>
  recentLeads: Array<Pick<Lead, 'id' | 'name' | 'created_at'>>
}

type FollowupWithLeadName = Followup & { leadName: string }
interface Cursor { at: string; id: string }
interface CursorPage<T> {
  items: T[]
  nextCursor: Cursor | null
  hasMore: boolean
}
type FollowupCursor = Cursor
type FollowupPage = CursorPage<FollowupWithLeadName>
type ActivityCursor = Cursor
type ActivityPage = CursorPage<Activity>

listFollowupsPage(list: FollowupList, cursor?: FollowupCursor | null, limit?: number): Promise<FollowupPage>
listByLeadPage(leadId: string, cursor?: FollowupCursor | null, limit?: number): Promise<FollowupPage>
listActivitiesPage(leadId: string, cursor?: ActivityCursor | null, limit?: number): Promise<ActivityPage>
```

- [ ] **Step 1: Write the failing dashboard service test.**

Replace `src/services/dashboardService.test.ts` with a test that mocks `requireSupabase` and asserts one RPC, no `listLeads`/`listFollowups` imports, exact `p_now`, and malformed-response rejection:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/db', () => ({
  requireSupabase: () => ({ rpc }),
  throwDbError: (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  },
}))

import { getDashboardData } from './dashboardService'

const snapshot = {
  generatedAt: '2026-11-26T12:00:00.000Z',
  indicators: {
    totalLeads: 3, novos: 1, contatados: 0, interessados: 1, negociando: 0,
    convertidos: 1, totalOportunidades: 1, altaPrioridade: 0,
    followupsPendentes: 0, followupsAtrasados: 0,
  },
  byMonth: [{ month: '11/26', total: 3 }],
  byNiche: [], byStatus: [], byPriority: [], funnel: [],
  pendingFollowups: [], recentActivities: [], recentStatusChanges: [],
  recentLeads: [],
}

describe('getDashboardData', () => {
  beforeEach(() => rpc.mockReset())

  it('loads one server-side snapshot with an explicit clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-26T12:00:00.000Z'))
    rpc.mockResolvedValue({ data: snapshot, error: null })
    try {
      await expect(getDashboardData()).resolves.toEqual(snapshot)
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(rpc).toHaveBeenCalledWith('get_dashboard_snapshot', { p_now: '2026-11-26T12:00:00.000Z' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects an incomplete snapshot instead of rendering partial KPIs', async () => {
    rpc.mockResolvedValue({ data: { generatedAt: snapshot.generatedAt }, error: null })
    await expect(getDashboardData()).rejects.toThrow('Resposta inválida do dashboard.')
  })

  it('rejects nonnumeric KPIs and malformed chart rows', async () => {
    rpc.mockResolvedValue({
      data: { ...snapshot, indicators: { ...snapshot.indicators, totalLeads: '3' }, byNiche: [{ label: 'Outros' }] },
      error: null,
    })
    await expect(getDashboardData()).rejects.toThrow('Resposta inválida do dashboard.')
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/services/dashboardService.test.ts
```

Expected RED: service still performs six direct sources and has no RPC.

- [ ] **Step 2: Replace the dashboard service.**

Replace `src/services/dashboardService.ts` with:

```ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { DashboardIndicators } from '../lib/dashboard'
import { ACTIVITY_TYPES, type Activity } from '../types/activity'
import type { Followup } from '../types/followup'
import type { Lead } from '../types/lead'

export interface ChartDatum { label: string; total: number }
export interface DashboardData {
  generatedAt: string
  indicators: DashboardIndicators
  byMonth: Array<{ month: string; total: number }>
  byNiche: ChartDatum[]
  byStatus: ChartDatum[]
  byPriority: ChartDatum[]
  funnel: ChartDatum[]
  pendingFollowups: Array<Followup & { leadName: string }>
  recentActivities: Array<Activity & { leadName: string }>
  recentStatusChanges: Array<Activity & { leadName: string }>
  recentLeads: Array<Pick<Lead, 'id' | 'name' | 'created_at'>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isChartList(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isRecord(item)
    && typeof item.label === 'string' && isCount(item.total))
}

function isSnapshot(value: unknown): value is DashboardData {
  if (!isRecord(value) || typeof value.generatedAt !== 'string'
      || Number.isNaN(Date.parse(value.generatedAt)) || !isRecord(value.indicators)) return false
  const indicatorKeys: Array<keyof DashboardIndicators> = [
    'totalLeads', 'novos', 'contatados', 'interessados', 'negociando', 'convertidos',
    'totalOportunidades', 'altaPrioridade', 'followupsPendentes', 'followupsAtrasados',
  ]
  if (!indicatorKeys.every((key) => isCount(value.indicators?.[key]))) return false
  if (!Array.isArray(value.byMonth) || !value.byMonth.every((item) => isRecord(item)
      && typeof item.month === 'string' && isCount(item.total))) return false
  if (!isChartList(value.byNiche) || !isChartList(value.byStatus)
      || !isChartList(value.byPriority) || !isChartList(value.funnel)) return false
  if (!Array.isArray(value.pendingFollowups) || !value.pendingFollowups.every((item) => isRecord(item)
      && typeof item.id === 'string' && typeof item.lead_id === 'string'
      && typeof item.due_at === 'string' && typeof item.leadName === 'string')) return false
  const isActivityList = (input: unknown) => Array.isArray(input) && input.every((item) => isRecord(item)
    && typeof item.id === 'string' && typeof item.lead_id === 'string'
    && typeof item.description === 'string' && typeof item.created_at === 'string'
    && typeof item.leadName === 'string' && ACTIVITY_TYPES.some((type) => type === item.type))
  if (!isActivityList(value.recentActivities) || !isActivityList(value.recentStatusChanges)) return false
  return Array.isArray(value.recentLeads) && value.recentLeads.every((item) => isRecord(item)
    && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.created_at === 'string')
}

export async function getDashboardData(): Promise<DashboardData> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_dashboard_snapshot', { p_now: new Date().toISOString() })
  throwDbError(error)
  if (!isSnapshot(data)) throw new Error('Resposta inválida do dashboard.')
  return data
}
```

Run the focused test. Expected GREEN. Keep `src/lib/dashboard.ts` and its pure math tests as the canonical reference used to verify SQL parity; the page no longer downloads rows to run those functions.

- [ ] **Step 3: Extract charts into a lazy component.**

Create `src/components/dashboard/DashboardCharts.tsx`:

```tsx
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PRIORITY_LABELS } from '../../types/lead'
import type { ChartDatum } from '../../services/dashboardService'
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

interface Props {
  byMonth: Array<{ month: string; total: number }>
  byNiche: ChartDatum[]
  byStatus: ChartDatum[]
  byPriority: ChartDatum[]
  funnel: ChartDatum[]
}

export function DashboardCharts({ byMonth, byNiche, byStatus, byPriority, funnel }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
    </div>
  )
}
```

- [ ] **Step 4: Rewire DashboardPage to the snapshot and lazy chart chunk.**

In `src/pages/DashboardPage.tsx`:

1. Replace the React import with `import { lazy, Suspense, useEffect, useRef, useState } from 'react'`; `useMemo` is no longer needed.
2. Remove the Recharts and `ChartCard` imports, `computeIndicators`, `conversionFunnel`, `countBy`, `leadsByMonth`, `DASHBOARD_LEAD_WINDOW`, `AXIS`, `GRID`, `TOOLTIP_STYLE`, `PRIORITY_COLORS`, `PENDING_LIMIT`, `ACTIVITY_LIMIT`, `STATUS_CHANGE_LIMIT`, `UNKNOWN_LEAD_NAME`, the `now` state, its interval effect, the load-success `setNow(Date.now())`, the `leadNameById` memo and every `data.leads`/`data.followups`/`data.convertedCount` reference.
3. Add:

```ts
const DashboardCharts = lazy(() => import('../components/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardCharts })))
```

4. Replace indicator/chart/pending derivation with:

```ts
const indicators = data?.indicators ?? null
const charts = data
const pendingFollowups = data?.pendingFollowups ?? []
const activities = data?.recentActivities ?? []
const statusChanges = data?.recentStatusChanges ?? []
```

5. Replace `data.leads.length === DASHBOARD_LEAD_WINDOW` and `windowNote` with no sample-window warning. Server totals are exact for the authenticated owner.
6. Replace `hasAnyData` with:

```ts
const hasAnyData = data.indicators.totalLeads > 0
  || data.indicators.convertidos > 0
  || data.indicators.followupsPendentes > 0
  || data.recentActivities.length > 0
  || data.recentStatusChanges.length > 0
  || data.recentLeads.length > 0
```

7. Replace the entire chart grid plus the separate `Próximos follow-ups` Card grid break with:

```tsx
<Suspense fallback={<p role="status" className="text-sm text-muted">Carregando gráficos…</p>}>
  <DashboardCharts
    byMonth={charts.byMonth}
    byNiche={charts.byNiche}
    byStatus={charts.byStatus}
    byPriority={charts.byPriority}
    funnel={charts.funnel}
  />
</Suspense>

<Card title="Próximos follow-ups" dot="lime">
  {pendingFollowups.length === 0 ? (
    <p className="text-sm text-muted">Nenhum follow-up pendente.</p>
  ) : (
    <ul className="flex flex-col gap-2" aria-label="Próximos follow-ups">
      {pendingFollowups.map((followup) => {
        const overdue = new Date(followup.due_at).getTime() < new Date(data.generatedAt).getTime()
        return (
          <li key={followup.id}>
            <Link to={`/leads/${followup.lead_id}`} className={cn(ROW_BASE, overdue ? 'border-danger/40 bg-danger/5' : 'border-line bg-elevated')}>
              <span className="min-w-0 truncate text-ink">{followup.leadName}</span>
              <time dateTime={followup.due_at} className={cn('shrink-0 text-xs', overdue ? 'font-medium text-danger' : 'text-muted')}>
                {formatDateTime(followup.due_at)} {overdue && '· atrasado'}
              </time>
            </Link>
          </li>
        )
      })}
    </ul>
  )}
</Card>
```

8. Keep the recent leads/activity/status cards, using `recentLeads` rows directly. The minute timer now only updates presentation time; a refresh gets fresh server counts. Existing refresh/race protection remains.

Update `DashboardPage.test.tsx` fixtures to the `DashboardData` shape above. Keep the Recharts mock; lazy loading means assertions use `findByTestId('chart')` and `waitFor`. Add a test where 2,000 leads are represented by `totalLeads: 2000`, the service is called once and no 1,000-row warning appears.

- [ ] **Step 5: Write failing tests for the page contract and both cursor services.**

Create `src/lib/cursorPagination.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { readCursorPage } from './cursorPagination'

const first = { id: '00000000-0000-0000-0000-000000000001', due_at: '2026-11-26T15:00:00Z' }
const second = { id: '00000000-0000-0000-0000-000000000002', due_at: '2026-11-26T15:00:00Z' }
const isItem = (value: unknown): value is { id: string; due_at: string } => !!value && typeof value === 'object'
  && typeof (value as { id?: unknown }).id === 'string'
  && typeof (value as { due_at?: unknown }).due_at === 'string'

describe('readCursorPage', () => {
  it('keeps the cursor on the last visible row even when timestamps tie', () => {
    expect(readCursorPage({
      items: [first, second],
      nextCursor: { at: second.due_at, id: second.id },
      hasMore: true,
    }, 2, isItem, 'due_at')).toEqual({
      items: [first, second],
      nextCursor: { at: second.due_at, id: second.id },
      hasMore: true,
    })
  })

  it.each([
    { items: [], nextCursor: null, hasMore: true },
    { items: [first], nextCursor: { at: first.due_at, id: first.id }, hasMore: true },
    { items: [first], nextCursor: null, hasMore: false },
    { items: [first, second], nextCursor: { at: first.due_at, id: first.id }, hasMore: true },
    { items: [first], nextCursor: { at: 'invalid', id: first.id }, hasMore: true },
    { items: [first], nextCursor: { at: first.due_at, id: 'not-a-uuid' }, hasMore: true },
    { items: [first, first], nextCursor: { at: first.due_at, id: first.id }, hasMore: true },
    { items: [{ ...first, id: 1 }], nextCursor: null, hasMore: false },
  ])('rejects malformed page %#', (payload) => {
    expect(() => readCursorPage(payload, 2, isItem, 'due_at')).toThrow('Resposta inválida da paginação.')
  })

  it('rejects a response larger than the requested visible page', () => {
    expect(() => readCursorPage({
      items: [first, second], nextCursor: null, hasMore: false,
    }, 1, isItem, 'due_at')).toThrow('Resposta inválida da paginação.')
  })
})
```

Create `src/services/cursorPagination.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/db', () => ({
  requireSupabase: () => ({ rpc }),
  throwDbError: (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  },
}))

import { listActivitiesPage } from './activityService'
import { listByLeadPage, listFollowupsPage } from './followupService'

const ownerId = '00000000-0000-0000-0000-000000000201'
const leadId = '00000000-0000-0000-0000-000000000101'
const followup = {
  id: '00000000-0000-0000-0000-000000000301', lead_id: leadId, owner_id: ownerId,
  due_at: '2026-11-26T15:00:00Z', reason: null, note: null, status: 'pendente',
  completed_at: null, result: null, created_at: '2026-11-26T12:00:00Z',
  updated_at: '2026-11-26T12:00:00Z', leadName: 'Lead A',
}
const activity = {
  id: '00000000-0000-0000-0000-000000000401', lead_id: leadId, owner_id: ownerId,
  type: 'observacao', description: 'Observação A', user_id: ownerId,
  created_at: '2026-11-26T15:00:00Z',
}
const page = <T,>(items: T[], at: string, id: string) => ({
  items, nextCursor: { at, id }, hasMore: true,
})

describe('cursor pagination services', () => {
  beforeEach(() => rpc.mockReset())

  it('passes the stable cursor and consumes leadName exactly as SQL returns it', async () => {
    rpc.mockResolvedValue({
      data: page([followup], followup.due_at, followup.id), error: null,
    })
    await expect(listFollowupsPage('today', { at: '2026-11-26T14:00:00Z', id: followup.id }, 1)).resolves.toEqual({
      items: [followup], nextCursor: { at: followup.due_at, id: followup.id }, hasMore: true,
    })
    expect(rpc).toHaveBeenCalledWith('list_followups_cursor', {
      p_list: 'today', p_after_at: '2026-11-26T14:00:00Z', p_after_id: followup.id, p_limit: 1,
    })
  })

  it('uses the lead-scoped follow-up RPC instead of an unbounded table read', async () => {
    rpc.mockResolvedValue({ data: { items: [], nextCursor: null, hasMore: false }, error: null })
    await expect(listByLeadPage(leadId, null, 10)).resolves.toEqual({ items: [], nextCursor: null, hasMore: false })
    expect(rpc).toHaveBeenCalledWith('list_lead_followups_cursor', {
      p_lead_id: leadId, p_after_at: null, p_after_id: null, p_limit: 10,
    })
  })

  it('uses the activity cursor RPC with a lead scope and validates its rows', async () => {
    rpc.mockResolvedValue({ data: page([activity], activity.created_at, activity.id), error: null })
    await expect(listActivitiesPage(leadId, null, 1)).resolves.toEqual({
      items: [activity], nextCursor: { at: activity.created_at, id: activity.id }, hasMore: true,
    })
    expect(rpc).toHaveBeenCalledWith('list_lead_activities_cursor', {
      p_lead_id: leadId, p_after_at: null, p_after_id: null, p_limit: 1,
    })
  })

  it.each([
    [{ items: [], nextCursor: null, hasMore: true }, 'hasMore sem item'],
    [{ items: [followup], nextCursor: null, hasMore: false }, 'cursor no fim'],
    [{ items: [followup], nextCursor: { at: '2026-11-26T14:00:00Z', id: followup.id }, hasMore: true }, 'cursor que não é a última visível'],
    [{ items: [{ ...followup, leadName: 7 }], nextCursor: null, hasMore: false }, 'nome inválido'],
    [{ items: [{ ...followup, due_at: 'invalid' }], nextCursor: null, hasMore: false }, 'data inválida'],
  ])('rejects malformed follow-up response %#', async (data) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(listFollowupsPage('all')).rejects.toThrow('Resposta inválida da paginação.')
  })

  it('rejects incomplete cursors and invalid limits before calling the RPC', async () => {
    await expect(listFollowupsPage('all', { at: followup.due_at } as never)).rejects.toThrow('Cursor inválido.')
    await expect(listActivitiesPage(leadId, null, 0)).rejects.toThrow('Limite inválido.')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects an activity type outside the canonical domain', async () => {
    rpc.mockResolvedValue({
      data: { items: [{ ...activity, type: 'unknown' }], nextCursor: null, hasMore: false }, error: null,
    })
    await expect(listActivitiesPage(leadId)).rejects.toThrow('Resposta inválida da paginação.')
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/lib/cursorPagination.test.ts src/services/cursorPagination.test.ts
```

Expected RED: the shared validator and page APIs do not exist.

- [ ] **Step 6: Implement the shared validator and bounded cursor services.**

Create `src/lib/cursorPagination.ts`:

```ts
export interface Cursor { at: string; id: string }
export interface CursorPage<T> {
  items: T[]
  nextCursor: Cursor | null
  hasMore: boolean
}

const PAGE_ERROR = 'Resposta inválida da paginação.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))
}

export function assertPageLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Limite inválido.')
}

export function normalizeCursor(value: unknown): Cursor | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value) || !isTimestamp(value.at) || !isUuid(value.id)) throw new Error('Cursor inválido.')
  return { at: value.at, id: value.id }
}

export function readCursorPage<T extends { id: string; due_at?: string; completed_at?: string; created_at?: string }>(
  value: unknown,
  limit: number,
  isItem: (item: unknown) => item is T,
  cursorField: 'due_at' | 'completed_at' | 'created_at',
): CursorPage<T> {
  assertPageLimit(limit)
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > limit
      || (value.hasMore === true && value.items.length !== limit)
      || !value.items.every(isItem) || typeof value.hasMore !== 'boolean') throw new Error(PAGE_ERROR)

  const items = value.items
  const ids = new Set(items.map((item) => item.id))
  if (ids.size !== items.length) throw new Error(PAGE_ERROR)

  let nextCursor: Cursor | null = null
  if (value.hasMore) {
    if (items.length === 0 || value.nextCursor === null || value.nextCursor === undefined) throw new Error(PAGE_ERROR)
    try {
      nextCursor = normalizeCursor(value.nextCursor)
    } catch {
      throw new Error(PAGE_ERROR)
    }
    const last = items[items.length - 1]
    if (!nextCursor || nextCursor.at !== last[cursorField] || nextCursor.id !== last.id) throw new Error(PAGE_ERROR)
  } else if (value.nextCursor !== null) {
    throw new Error(PAGE_ERROR)
  }

  return { items, nextCursor, hasMore: value.hasMore }
}
```

In `src/services/followupService.ts`, merge the cursor imports with the existing `requireSupabase`/`throwDbError` and `Followup` imports, then replace the unbounded `listFollowups` and `listByLead` functions with:

```ts
import { assertPageLimit, isRecord, isTimestamp, isUuid, normalizeCursor, readCursorPage } from '../lib/cursorPagination'
import type { Cursor, CursorPage } from '../lib/cursorPagination'

export type FollowupCursor = Cursor
export type FollowupWithLeadName = Followup & { leadName: string }
export type FollowupPage = CursorPage<FollowupWithLeadName>

const FOLLOWUP_LISTS: FollowupList[] = ['today', 'upcoming', 'overdue', 'done', 'all']

function isFollowup(value: unknown): value is Followup {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.lead_id) || !isUuid(value.owner_id)
      || !isTimestamp(value.due_at) || !isTimestamp(value.created_at) || !isTimestamp(value.updated_at)
      || typeof value.status !== 'string' || !['pendente', 'concluido', 'cancelado'].includes(value.status)) return false
  const nullableText = (input: unknown) => input === null || typeof input === 'string'
  return nullableText(value.reason) && nullableText(value.note) && nullableText(value.result)
    && (value.completed_at === null || isTimestamp(value.completed_at))
}

function isFollowupWithLeadName(value: unknown): value is FollowupWithLeadName {
  return isFollowup(value) && isRecord(value)
    && typeof value.leadName === 'string' && value.leadName.trim().length > 0
}

function followupParams(list: FollowupList, cursor: FollowupCursor | null, limit: number) {
  if (!FOLLOWUP_LISTS.includes(list)) throw new Error('Lista de follow-ups inválida.')
  assertPageLimit(limit)
  const next = normalizeCursor(cursor)
  return { p_list: list, p_after_at: next?.at ?? null, p_after_id: next?.id ?? null, p_limit: limit }
}

export async function listFollowupsPage(
  list: FollowupList,
  cursor: FollowupCursor | null = null,
  limit = 50,
): Promise<FollowupPage> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('list_followups_cursor', followupParams(list, cursor, limit))
  throwDbError(error)
  return readCursorPage(data, limit, isFollowupWithLeadName, list === 'done' ? 'completed_at' : 'due_at')
}

export async function listByLeadPage(
  leadId: string,
  cursor: FollowupCursor | null = null,
  limit = 50,
): Promise<FollowupPage> {
  if (!isUuid(leadId)) throw new Error('Lead inválido.')
  assertPageLimit(limit)
  const next = normalizeCursor(cursor)
  const client = requireSupabase()
  const { data, error } = await client.rpc('list_lead_followups_cursor', {
    p_lead_id: leadId, p_after_at: next?.at ?? null, p_after_id: next?.id ?? null, p_limit: limit,
  })
  throwDbError(error)
  return readCursorPage(data, limit, isFollowupWithLeadName, 'due_at')
}

export async function getFollowup(leadId: string, followupId: string): Promise<Followup | null> {
  if (!isUuid(leadId) || !isUuid(followupId)) throw new Error('Follow-up inválido.')
  const client = requireSupabase()
  const { data, error } = await client
    .from('lead_followups')
    .select('*')
    .eq('lead_id', leadId)
    .eq('id', followupId)
    .maybeSingle()
  throwDbError(error)
  if (data === null) return null
  if (!isFollowup(data)) throw new Error('Resposta inválida do follow-up.')
  return data
}

/** Usado apenas para pontuar a fila de oportunidades; falha em vez de truncar silenciosamente. */
export async function collectFollowupsForQueue(list: FollowupList, maxRows = 10_000): Promise<FollowupWithLeadName[]> {
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10_000) throw new Error('Limite inválido.')
  const rows: FollowupWithLeadName[] = []
  let cursor: FollowupCursor | null = null
  do {
    const page = await listFollowupsPage(list, cursor, 100)
    rows.push(...page.items)
    if (rows.length > maxRows) throw new Error('A fila excede o limite de processamento. Refine os filtros.')
    cursor = page.nextCursor
  } while (cursor)
  return rows
}
```

Remove `listFollowups` and `listByLead`; do not leave first-page wrappers that can be mistaken for complete histories. `collectFollowupsForQueue` is explicit, cursor-based and fails at its safety cap; it is not a timeline API. Migrate every caller in this task. `FollowupList` continues to include `all`.

In `src/services/activityService.ts`, merge the cursor imports and change the existing type-only activity import to `import { ACTIVITY_TYPES, type Activity, type ActivityType } from '../types/activity'`, then replace `listActivities` with:

```ts
import { assertPageLimit, isRecord, isTimestamp, isUuid, normalizeCursor, readCursorPage } from '../lib/cursorPagination'
import type { Cursor, CursorPage } from '../lib/cursorPagination'

export type ActivityCursor = Cursor
export type ActivityPage = CursorPage<Activity>

function isActivity(value: unknown): value is Activity {
  return isRecord(value) && isUuid(value.id) && isUuid(value.lead_id) && isUuid(value.owner_id)
    && ACTIVITY_TYPES.some((type) => type === value.type)
    && typeof value.description === 'string'
    && (value.user_id === null || isUuid(value.user_id))
    && isTimestamp(value.created_at)
}

export async function listActivitiesPage(
  leadId: string,
  cursor: ActivityCursor | null = null,
  limit = 50,
): Promise<ActivityPage> {
  if (!isUuid(leadId)) throw new Error('Lead inválido.')
  assertPageLimit(limit)
  const next = normalizeCursor(cursor)
  const client = requireSupabase()
  const { data, error } = await client.rpc('list_lead_activities_cursor', {
    p_lead_id: leadId, p_after_at: next?.at ?? null, p_after_id: next?.id ?? null, p_limit: limit,
  })
  throwDbError(error)
  return readCursorPage(data, limit, isActivity, 'created_at')
}
```

Keep `listRecentActivities` and `listRecentStatusChanges` bounded for the existing dashboard until Step 2 removes their imports. No service may expose an unbounded activity/follow-up timeline.

- [ ] **Step 7: Add tested load-more behavior to follow-ups and activity timelines.**

First migrate the existing tests mechanically: replace `listFollowups`/`listByLead`/`listActivities` mocks with `listFollowupsPage`/`listByLeadPage`/`listActivitiesPage`; every resolved array becomes `{ items, nextCursor: null, hasMore: false }`; add `leadName` to follow-up fixtures; expected default calls become `(list, null, 50)`, `(leadId, null, 50)`. In `FollowupItem.test.tsx`, `loadLatest` becomes `async (followupId) => makeFollowup({ id: followupId })` (or the desired status/null), and assertions must prove the target ID is passed. Do not weaken existing race/mutation assertions.

Create `src/pages/FollowUpsPage.pagination.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../hooks/useToast'
import { listFollowupsPage } from '../services/followupService'
import { listLeads } from '../services/leadService'
import type { Followup } from '../types/followup'
import { FollowUpsPage } from './FollowUpsPage'

vi.mock('../services/followupService', () => ({
  listFollowupsPage: vi.fn(), completeFollowup: vi.fn(), cancelFollowup: vi.fn(), createFollowup: vi.fn(),
}))
vi.mock('../services/leadService', () => ({ listLeads: vi.fn() }))

const ownerId = '00000000-0000-0000-0000-000000000201'
const leadId = '00000000-0000-0000-0000-000000000101'
const makeFollowup = (id: string, reason: string): Followup => ({
  id, lead_id: leadId, owner_id: ownerId, due_at: '2026-11-26T15:00:00Z', reason, note: null,
  status: 'pendente', completed_at: null, result: null,
  created_at: '2026-11-26T12:00:00Z', updated_at: '2026-11-26T12:00:00Z',
})
const first = { ...makeFollowup('00000000-0000-0000-0000-000000000301', 'Primeiro contato'), leadName: 'Lead A' }
const second = { ...makeFollowup('00000000-0000-0000-0000-000000000302', 'Segundo contato'), leadName: 'Lead A' }
const firstCursor = { at: first.due_at, id: first.id }

function renderPage() {
  return render(
    <ToastContext.Provider value={{ toast: vi.fn() }}>
      <MemoryRouter><FollowUpsPage /></MemoryRouter>
    </ToastContext.Provider>,
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listLeads).mockResolvedValue({ leads: [], total: 0 })
})

describe('FollowUpsPage cursor loading', () => {
  it('appends a tied-timestamp page using the last visible row as cursor', async () => {
    vi.mocked(listFollowupsPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: firstCursor, hasMore: true })
      .mockResolvedValueOnce({ items: [second], nextCursor: null, hasMore: false })
    renderPage()
    await screen.findByText('Primeiro contato')

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await screen.findByText('Segundo contato')

    expect(listFollowupsPage).toHaveBeenNthCalledWith(1, 'today', null, 50)
    expect(listFollowupsPage).toHaveBeenNthCalledWith(2, 'today', firstCursor, 50)
    const rows = within(screen.getByRole('list', { name: 'Follow-ups' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Primeiro contato'), expect.stringContaining('Segundo contato'),
    ])
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  it('preserves rows and cursor on failure, shows a public error and retries the same page', async () => {
    vi.mocked(listFollowupsPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: firstCursor, hasMore: true })
      .mockRejectedValueOnce(new Error('backend secret detail'))
      .mockResolvedValueOnce({ items: [second], nextCursor: null, hasMore: false })
    renderPage()
    await screen.findByText('Primeiro contato')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível carregar mais follow-ups. Tente novamente.')
    expect(alert.textContent).not.toContain('backend secret detail')
    expect(screen.getByText('Primeiro contato')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Segundo contato')
    expect(listFollowupsPage).toHaveBeenNthCalledWith(3, 'today', firstCursor, 50)
  })

  it('does not append a late page after the tab changes', async () => {
    let resolveOld!: (value: unknown) => void
    vi.mocked(listFollowupsPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: firstCursor, hasMore: true })
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce({ items: [], nextCursor: null, hasMore: false })
    renderPage()
    await screen.findByText('Primeiro contato')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await waitFor(() => expect(listFollowupsPage).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Atrasados' }))
    await waitFor(() => expect(listFollowupsPage).toHaveBeenNthCalledWith(3, 'overdue', null, 50))
    resolveOld({ items: [second], nextCursor: null, hasMore: false })
    await waitFor(() => expect(screen.queryByText('Segundo contato')).toBeNull())
  })
})
```

Create `src/components/leads/LeadTimeline.pagination.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listActivitiesPage } from '../../services/activityService'
import type { Activity } from '../../types/activity'
import { LeadTimeline } from './LeadTimeline'

vi.mock('../../services/activityService', () => ({ listActivitiesPage: vi.fn() }))

const leadId = '00000000-0000-0000-0000-000000000101'
const ownerId = '00000000-0000-0000-0000-000000000201'
const makeActivity = (id: string, description: string): Activity => ({
  id, lead_id: leadId, owner_id: ownerId, type: 'observacao', description,
  user_id: ownerId, created_at: '2026-11-26T15:00:00Z',
})
const first = makeActivity('00000000-0000-0000-0000-000000000401', 'Atividade recente')
const second = makeActivity('00000000-0000-0000-0000-000000000402', 'Atividade anterior')
const cursor = { at: first.created_at, id: first.id }

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('LeadTimeline cursor loading', () => {
  it('appends older rows with the same timestamp without replacing the visible history', async () => {
    vi.mocked(listActivitiesPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: cursor, hasMore: true })
      .mockResolvedValueOnce({ items: [second], nextCursor: null, hasMore: false })
    render(<LeadTimeline leadId={leadId} refreshKey={0} />)
    await screen.findByText('Atividade recente')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await screen.findByText('Atividade anterior')

    expect(listActivitiesPage).toHaveBeenNthCalledWith(2, leadId, cursor, 50)
    expect(screen.getByText('Atividade recente')).toBeTruthy()
    expect(screen.getByText('Mostrando as atividades mais recentes')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  it('keeps the current history and retries the same cursor after a failure', async () => {
    vi.mocked(listActivitiesPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: cursor, hasMore: true })
      .mockRejectedValueOnce(new Error('backend secret detail'))
      .mockResolvedValueOnce({ items: [second], nextCursor: null, hasMore: false })
    render(<LeadTimeline leadId={leadId} refreshKey={0} />)
    await screen.findByText('Atividade recente')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível carregar mais atividades. Tente novamente.')
    expect(alert.textContent).not.toContain('backend secret detail')
    expect(screen.getByText('Atividade recente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Atividade anterior')
    expect(listActivitiesPage).toHaveBeenNthCalledWith(3, leadId, cursor, 50)
  })
})
```

Create `src/components/leads/LeadFollowups.pagination.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastContext } from '../../hooks/useToast'
import { getFollowup, listByLeadPage } from '../../services/followupService'
import type { Followup } from '../../types/followup'
import { LeadFollowups } from './LeadFollowups'

vi.mock('../../services/followupService', () => ({
  listByLeadPage: vi.fn(), getFollowup: vi.fn(), completeFollowup: vi.fn(), cancelFollowup: vi.fn(),
}))

const leadId = '00000000-0000-0000-0000-000000000101'
const ownerId = '00000000-0000-0000-0000-000000000201'
const makeFollowup = (id: string, reason: string): Followup => ({
  id, lead_id: leadId, owner_id: ownerId, due_at: '2026-11-26T15:00:00Z', reason, note: null,
  status: 'pendente', completed_at: null, result: null,
  created_at: '2026-11-26T12:00:00Z', updated_at: '2026-11-26T12:00:00Z',
})
const first = { ...makeFollowup('00000000-0000-0000-0000-000000000301', 'Follow-up recente'), leadName: 'Lead A' }
const second = { ...makeFollowup('00000000-0000-0000-0000-000000000302', 'Follow-up anterior'), leadName: 'Lead A' }
const cursor = { at: first.due_at, id: first.id }

function renderSheet() {
  return render(
    <ToastContext.Provider value={{ toast: vi.fn() }}>
      <LeadFollowups leadId={leadId} refreshKey={0} onChanged={vi.fn()} leadName="Lead A" />
    </ToastContext.Provider>,
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getFollowup).mockResolvedValue(first)
})

describe('LeadFollowups cursor loading', () => {
  it('paginates the lead history and validates a mutation by its exact ID', async () => {
    vi.mocked(listByLeadPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: cursor, hasMore: true })
      .mockResolvedValueOnce({ items: [second], nextCursor: null, hasMore: false })
    renderSheet()
    await screen.findByText('Follow-up recente')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    await screen.findByText('Follow-up anterior')
    expect(listByLeadPage).toHaveBeenNthCalledWith(2, leadId, cursor, 50)
    expect(screen.getByText('Follow-up recente')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Concluir follow-up/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }))
    await vi.waitFor(() => expect(getFollowup).toHaveBeenCalledWith(leadId, first.id))
  })

  it('preserves loaded rows when the next page fails', async () => {
    vi.mocked(listByLeadPage)
      .mockResolvedValueOnce({ items: [first], nextCursor: cursor, hasMore: true })
      .mockRejectedValueOnce(new Error('backend secret detail'))
    renderSheet()
    await screen.findByText('Follow-up recente')
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível carregar mais follow-ups. Tente novamente.')
    expect(screen.getByText('Follow-up recente')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeTruthy()
  })
})
```

Run these tests before implementation; expected RED is the old unbounded service call or missing `Carregar mais`.

Implement the UI as follows:

- `FollowUpsPage.tsx`: store `FollowupWithLeadName[]`, `cursor`, `hasMore`, `loadingMore`, `loadMoreError` and a row-request generation ref. Initial/tab/refresh load calls `listFollowupsPage(tab, null, 50)` and replaces all page state. `Carregar mais` captures the current tab/cursor/generation, calls `listFollowupsPage(tab, cursor, 50)`, ignores stale responses, appends IDs not already visible, then stores the returned cursor/`hasMore`. A failed append keeps rows, cursor and `hasMore`, sets only the public message `Não foi possível carregar mais follow-ups. Tente novamente.`, and retries the same cursor. Disable the button while loading; never use `.range()`. Render `followup.leadName` directly; retain the bounded lead query only for scheduling. Reset all cursor state on tab/refresh.
- `LeadTimeline.tsx`: use `listActivitiesPage(leadId, null, 50)` for initial/refresh replacement and `listActivitiesPage(leadId, cursor, 50)` for append. Reuse the existing request/mounted guards so a late append cannot overwrite a refresh or another lead. Preserve rows/cursor on append failure and expose the public retry message `Não foi possível carregar mais atividades. Tente novamente.`. Show `Carregar mais` only while `hasMore`; show `Mostrando as atividades mais recentes` while more rows exist.
- `LeadFollowups.tsx`: use `listByLeadPage` with the same replace/append state machine. Change `FollowupItem`'s `loadLatest` prop to `(followupId: string) => Promise<Followup | null>`; `validateLatest` calls `getFollowup(leadId, followupId)`, so validation remains exact and bounded even when the target is on a later page. Pass `loadingMore` as pending to row controls. Preserve rows/cursor on append failure and provide the same public retry message as `FollowUpsPage`.
- `OpportunitiesPage.tsx`: replace `listFollowups('overdue')` with `collectFollowupsForQueue('overdue')`; update its service mock/tests to the new name while preserving queue-ordering assertions. Do not replace the collector with a first-page wrapper.
- `LeadDetailPage.conversion.test.tsx`: mock `listActivitiesPage` and `listByLeadPage`, return page objects, and keep all conversion/race assertions. `PipelinePage.test.tsx` only drops the obsolete `listActivities` mock; the page itself does not render a timeline.

- [ ] **Step 8: Lazy-load routes without taking ownership of page implementations.**

Replace `src/routes/AppRoutes.tsx` with the following integration after WP0–WP4 are complete:

```tsx
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppLayout } from '../layouts/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from '../pages/LoginPage'
import { StatusPage } from '../pages/StatusPage'
import { NotFoundPage } from '../pages/NotFoundPage'

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const LeadsPage = lazy(() => import('../pages/LeadsPage').then((m) => ({ default: m.LeadsPage })))
const OpportunitiesPage = lazy(() => import('../pages/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })))
const PipelinePage = lazy(() => import('../pages/PipelinePage').then((m) => ({ default: m.PipelinePage })))
const ClientsPage = lazy(() => import('../pages/ClientsPage').then((m) => ({ default: m.ClientsPage })))
const ClientNewPage = lazy(() => import('../pages/ClientNewPage').then((m) => ({ default: m.ClientNewPage })))
const ClientDetailPage = lazy(() => import('../pages/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })))
const ProjectsPage = lazy(() => import('../pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ProjectNewPage = lazy(() => import('../pages/ProjectNewPage').then((m) => ({ default: m.ProjectNewPage })))
const ProjectDetailPage = lazy(() => import('../pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const FinancePage = lazy(() => import('../pages/FinancePage').then((m) => ({ default: m.FinancePage })))
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const BackupPage = lazy(() => import('../pages/BackupPage').then((m) => ({ default: m.BackupPage })))
const FollowUpsPage = lazy(() => import('../pages/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })))
const LeadNewPage = lazy(() => import('../pages/LeadNewPage').then((m) => ({ default: m.LeadNewPage })))
const LeadDetailPage = lazy(() => import('../pages/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })))
const LeadEditPage = lazy(() => import('../pages/LeadEditPage').then((m) => ({ default: m.LeadEditPage })))

export function AppRoutes() {
  return (
    <Suspense fallback={<div role="status" className="p-8 text-sm text-muted">Carregando página…</div>}>
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
            <Route path="/projetos" element={<ProjectsPage />} />
            <Route path="/projetos/novo" element={<ProjectNewPage />} />
            <Route path="/projetos/:id" element={<ProjectDetailPage />} />
            <Route path="/financeiro" element={<FinancePage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/followups" element={<FollowUpsPage />} />
            <Route path="/leads/novo" element={<LeadNewPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/leads/:id/editar" element={<LeadEditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
```

If WP4 already exposes Backup under another protected path, retain that route as an alias to the same lazy `BackupPage`; do not create a second page. Update `AppRoutes.test.tsx` to mock each lazy page module, use `findByRole`/`findByText`, and assert every path stays inside `ProtectedRoute` and `AppLayout`.

- [ ] **Step 9: Verify Reports/export and query contracts owned by WP3/WP4.**

Read `reportService.ts` and the `0010` export RPCs. Verify:

- Server aggregation, stable `(sort_value,id)` cursor, maximum 1,000 rows/page.
- A safety cap aborts the export; no partial file is labeled complete.
- UTF-8/BOM/`;`/pt-BR dates/money and formula protection.
- Every query includes owner scope through RLS and filters.
- No service-role client or secret is present.
- Reports and Backup pages are lazy; Recharts is lazy in both.

If any item fails, record an Important dependency blocker against the owning plan; do not duplicate the report/export implementation in this plan.

- [ ] **Step 10: Verify and commit.**

```bash
npm test -- --maxWorkers=2 src/services/dashboardService.test.ts src/pages/DashboardPage.test.tsx src/lib/cursorPagination.test.ts src/services/cursorPagination.test.ts src/services/followupService.test.ts src/services/activityService.test.ts src/pages/FollowUpsPage.test.tsx src/pages/FollowUpsPage.pagination.test.tsx src/components/leads/LeadTimeline.test.tsx src/components/leads/LeadTimeline.pagination.test.tsx src/components/leads/LeadFollowups.test.tsx src/components/leads/LeadFollowups.leadName.test.tsx src/components/leads/LeadFollowups.pagination.test.tsx src/components/followups/FollowupItem.test.tsx src/pages/OpportunitiesPage.test.tsx src/pages/LeadDetailPage.conversion.test.tsx src/pages/PipelinePage.test.tsx src/routes/AppRoutes.test.tsx
git diff --check
git add src/services/dashboardService.ts src/services/dashboardService.test.ts src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/components/dashboard/DashboardCharts.tsx src/lib/cursorPagination.ts src/lib/cursorPagination.test.ts src/services/followupService.ts src/services/followupService.test.ts src/services/cursorPagination.test.ts src/pages/FollowUpsPage.tsx src/pages/FollowUpsPage.test.tsx src/pages/FollowUpsPage.pagination.test.tsx src/services/activityService.ts src/services/activityService.test.ts src/components/leads/LeadTimeline.tsx src/components/leads/LeadTimeline.test.tsx src/components/leads/LeadTimeline.pagination.test.tsx src/components/followups/FollowupItem.tsx src/components/followups/FollowupItem.test.tsx src/components/leads/LeadFollowups.tsx src/components/leads/LeadFollowups.test.tsx src/components/leads/LeadFollowups.leadName.test.tsx src/components/leads/LeadFollowups.pagination.test.tsx src/pages/OpportunitiesPage.tsx src/pages/OpportunitiesPage.test.tsx src/pages/LeadDetailPage.conversion.test.tsx src/pages/PipelinePage.test.tsx src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx
git commit -m "perf: agregar dashboard no servidor e cursorizar listas"
```

Do not build in this task. Task 11 owns the fresh production build and bundle inspection after all route integrations exist.

---

### Task 8: Add integrated mocked journey and real-browser responsive smoke tests

**Files:**

- Create: `src/pages/IntegratedJourney.test.tsx`
- Create: `playwright.config.ts`
- Create: `e2e/journey.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json` through `npm install` during execution, never by hand.

**Interfaces:**

- Unit/component integration renders real pages/components with service boundaries mocked.
- Playwright uses a fake public Supabase URL/key and intercepted network only; no real account, secret or remote database.
- Viewports: 390×844 and 1440×1000.

- [ ] **Step 1: Write the integrated journey test before adding browser tooling.**

Create `src/pages/IntegratedJourney.test.tsx` with the literal test below. It renders the real `AppRoutes`, layout and pages; only service/auth/database/chart boundaries are mocked. The test creates a client and project, completes a task, records and pays financial movements, changes report filters, saves settings, retries Backup diagnostics and proves stale route responses are discarded.

```tsx
// @vitest-environment jsdom
// src/pages/IntegratedJourney.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Project, ProjectDetail, ProjectTask } from '../types/project'
import { DEFAULT_PREFERENCES, DEFAULT_SETTINGS } from '../types/settings'

const ids = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-0000000000d01',
  client: '00000000-0000-4000-8000-0000000000c01',
  contract: '00000000-0000-4000-8000-0000000000a01',
  project: '00000000-0000-4000-8000-0000000000e01',
  task: '00000000-0000-4000-8000-0000000000f01',
  installment: '00000000-0000-4000-8000-00000000000101',
  payment: '00000000-0000-4000-8000-00000000000102',
  expense: '00000000-0000-4000-8000-00000000000103',
}))

const mocks = vi.hoisted(() => ({
  authState: {
    session: null as unknown,
    user: null as { id: string; email: string } | null,
    loading: false,
    signOut: vi.fn(),
  },
  signIn: vi.fn(),
  getDashboardData: vi.fn(),
  countOverdue: vi.fn(),
  listClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
  findClientDuplicateCandidates: vi.fn(),
  countConvertedLeads: vi.fn(),
  getLeadClientLink: vi.fn(),
  listLeadClientLinks: vi.fn(),
  listProjects: vi.fn(),
  listProjectsForBoard: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  setProjectStatus: vi.fn(),
  deliverProject: vi.fn(),
  listProjectFormOptions: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  reorderTasks: vi.fn(),
  listRevisions: vi.fn(),
  createRevision: vi.fn(),
  updateRevision: vi.fn(),
  listContracts: vi.fn(),
  listPayments: vi.fn(),
  getContractFinancials: vi.fn(),
  createContract: vi.fn(),
  replaceInstallments: vi.fn(),
  adjustContract: vi.fn(),
  cancelContract: vi.fn(),
  recordPayment: vi.fn(),
  listExpenses: vi.fn(),
  listOverdueExpenses: vi.fn(),
  listExpensesForClient: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  updateExpenseNotes: vi.fn(),
  payExpense: vi.fn(),
  cancelExpense: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  archiveCategory: vi.fn(),
  getFinancialSummary: vi.fn(),
  getCashFlow: vi.fn(),
  getExpenseCategoryTotals: vi.fn(),
  loadReportData: vi.fn(),
  getReportFilterOptions: vi.fn(),
  exportReport: vi.fn(),
  getSettings: vi.fn(),
  getProfileName: vi.fn(),
  updateProfileName: vi.fn(),
  saveSettings: vi.fn(),
  saveConfiguration: vi.fn(),
  previewOpportunityRecalculation: vi.fn(),
  confirmOpportunityRecalculation: vi.fn(),
  exportBackup: vi.fn(),
  importBackupFile: vi.fn(),
  previewRestore: vi.fn(),
  restoreBackup: vi.fn(),
  getDiagnostics: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({ useAuth: () => mocks.authState }))
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: null,
  supabaseUrl: 'https://mock-project.supabase.co',
  supabaseAnonKey: 'mock-public-anon-key',
}))
vi.mock('../lib/db', () => {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'neq', 'order', 'eq']) query[method] = vi.fn(() => query)
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
    data: [{ id: ids.project, name: 'Site Integrado', client_id: ids.client }],
    error: null,
  }).then(resolve)
  return {
    requireSupabase: () => ({ from: () => query }),
    throwDbError: (error: { message: string } | null) => { if (error) throw new Error(error.message) },
  }
})
vi.mock('recharts', () => {
  const Chart = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const Empty = () => null
  return {
    ResponsiveContainer: Chart, AreaChart: Chart, BarChart: Chart, LineChart: Chart,
    ComposedChart: Chart, PieChart: Chart, Area: Empty, Bar: Empty, Line: Empty, Pie: Empty,
    CartesianGrid: Empty, XAxis: Empty, YAxis: Empty, Tooltip: Empty, Cell: Empty, Legend: Empty,
  }
})
vi.mock('../services/authService', () => ({ signIn: mocks.signIn }))
vi.mock('../services/dashboardService', () => ({ getDashboardData: mocks.getDashboardData }))
vi.mock('../services/followupService', () => ({
  countOverdue: mocks.countOverdue, listFollowupsPage: vi.fn(), listByLeadPage: vi.fn(),
  getFollowup: vi.fn(), completeFollowup: vi.fn(), cancelFollowup: vi.fn(),
  createFollowup: vi.fn(), collectFollowupsForQueue: vi.fn(),
}))
vi.mock('../services/activityService', () => ({
  listActivitiesPage: vi.fn(), listRecentActivities: vi.fn(), listRecentStatusChanges: vi.fn(),
}))
vi.mock('../services/clientService', () => ({
  listClients: mocks.listClients, getClient: mocks.getClient, createClient: mocks.createClient,
  updateClient: mocks.updateClient, archiveClient: mocks.archiveClient,
  findClientDuplicateCandidates: mocks.findClientDuplicateCandidates,
  countConvertedLeads: mocks.countConvertedLeads, getLeadClientLink: mocks.getLeadClientLink,
  listLeadClientLinks: mocks.listLeadClientLinks,
}))
vi.mock('../services/projectService', () => ({
  listProjects: mocks.listProjects, listProjectsForBoard: mocks.listProjectsForBoard,
  getProject: mocks.getProject, createProject: mocks.createProject, updateProject: mocks.updateProject,
  setProjectStatus: mocks.setProjectStatus, deliverProject: mocks.deliverProject,
  listProjectFormOptions: mocks.listProjectFormOptions, listTasks: mocks.listTasks,
  createTask: mocks.createTask, updateTask: mocks.updateTask, deleteTask: mocks.deleteTask,
  reorderTasks: mocks.reorderTasks,
}))
vi.mock('../services/projectRevisionService', () => ({
  listRevisions: mocks.listRevisions, createRevision: mocks.createRevision, updateRevision: mocks.updateRevision,
}))
vi.mock('../services/contractService', () => ({
  listContracts: mocks.listContracts, listPayments: mocks.listPayments,
  getContractFinancials: mocks.getContractFinancials, createContract: mocks.createContract,
  replaceInstallments: mocks.replaceInstallments, adjustContract: mocks.adjustContract,
  cancelContract: mocks.cancelContract, recordPayment: mocks.recordPayment,
}))
vi.mock('../services/expenseService', () => ({
  listExpenses: mocks.listExpenses, listOverdueExpenses: mocks.listOverdueExpenses,
  listExpensesForClient: mocks.listExpensesForClient, createExpense: mocks.createExpense,
  updateExpense: mocks.updateExpense, updateExpenseNotes: mocks.updateExpenseNotes,
  payExpense: mocks.payExpense, cancelExpense: mocks.cancelExpense,
  listCategories: mocks.listCategories, createCategory: mocks.createCategory,
  archiveCategory: mocks.archiveCategory,
}))
vi.mock('../services/financialService', () => ({
  getFinancialSummary: mocks.getFinancialSummary, getCashFlow: mocks.getCashFlow,
  getExpenseCategoryTotals: mocks.getExpenseCategoryTotals,
}))
vi.mock('../services/reportService', () => ({
  loadReportData: mocks.loadReportData, getReportFilterOptions: mocks.getReportFilterOptions,
  exportReport: mocks.exportReport,
}))
vi.mock('../services/settingsService', () => ({
  getSettings: mocks.getSettings, getProfileName: mocks.getProfileName,
  updateProfileName: mocks.updateProfileName, saveSettings: mocks.saveSettings,
  saveConfiguration: mocks.saveConfiguration,
  previewOpportunityRecalculation: mocks.previewOpportunityRecalculation,
  confirmOpportunityRecalculation: mocks.confirmOpportunityRecalculation,
}))
vi.mock('../services/backupService', () => ({
  exportBackup: mocks.exportBackup, importBackupFile: mocks.importBackupFile,
  previewRestore: mocks.previewRestore, restoreBackup: mocks.restoreBackup,
  getDiagnostics: mocks.getDiagnostics,
}))

import { ToastProvider } from '../components/ui/Toast'
import { AppRoutes } from '../routes/AppRoutes'

let navigate: NavigateFunction
function Navigator() {
  navigate = useNavigate()
  return null
}

const emptySnapshot = {
  generatedAt: '2026-11-27T12:00:00.000Z',
  indicators: {
    totalLeads: 0, novos: 0, contatados: 0, interessados: 0, negociando: 0,
    convertidos: 0, totalOportunidades: 0, altaPrioridade: 0,
    followupsPendentes: 0, followupsAtrasados: 0,
  },
  byMonth: [], byNiche: [], byStatus: [], byPriority: [], funnel: [],
  pendingFollowups: [], recentActivities: [], recentStatusChanges: [], recentLeads: [],
}

const client = {
  id: ids.client, owner_id: ids.owner, creation_key: '00000000-0000-4000-8000-0000000000b11',
  name: 'Empresa Integrada', responsible_name: 'Maria', phone: '11999999999', whatsapp: '11999999999',
  email: 'maria@example.test', cnpj: '12.345.678/0001-95', website: null, instagram: null,
  address: null, city: 'São Paulo', district: null, zip_code: null, state: 'SP', niche: 'salao',
  status: 'active', notes: null, cnpj_digits: '12345678000195', phone_canonical: '11999999999',
  whatsapp_canonical: '11999999999', source: 'manual', converted_at: null, archived_at: null,
  created_at: '2026-11-27T10:00:00.000Z', updated_at: '2026-11-27T10:00:00.000Z',
}
const contract = {
  id: ids.contract, owner_id: ids.owner, client_id: ids.client, source_link_id: null,
  creation_key: '00000000-0000-4000-8000-0000000000b12', service: 'Site', total_value_cents: 100000,
  contracted_at: '2026-11-27', due_date: '2026-12-27', payment_method: 'pix', payment_terms: null,
  status: 'active', notes: null, cancelled_at: null,
  created_at: '2026-11-27T10:00:00.000Z', updated_at: '2026-11-27T10:00:00.000Z',
}
const project: Project = {
  id: ids.project, owner_id: ids.owner, client_id: ids.client, contract_id: ids.contract,
  source_link_id: null, name: 'Site Integrado', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: '2026-11-27', due_date: '2026-12-10', responsible_name: null,
  priority: 'medium', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null,
  archived_at: null, created_at: '2026-11-27T10:00:00.000Z', updated_at: '2026-11-27T10:00:00.000Z',
}
let task: ProjectTask = {
  id: ids.task, owner_id: ids.owner, project_id: ids.project, title: 'Layout', description: null,
  status: 'pending', responsible_name: null, start_date: '2026-11-27', due_date: '2026-12-01',
  priority: 'medium', position: 0, notes: null, completed_at: null, cancelled_at: null,
  created_at: '2026-11-27T10:00:00.000Z', updated_at: '2026-11-27T10:00:00.000Z',
}
let projectDetail: ProjectDetail = {
  ...project, client_name: 'Empresa Integrada', progressPercent: 0, activeTasks: 1, completedTasks: 0,
  tasks: [task], revisions: [], activities: [],
}
const clientDetail = {
  client, contracts: [contract], projects: [], activities: [], linkedLeads: [], history: [],
}
const installment = {
  id: ids.installment, owner_id: ids.owner, contract_id: ids.contract, position: 0,
  amount_cents: 100000, due_date: '2026-12-27', notes: null,
  created_at: '2026-11-27T10:00:00.000Z', updated_at: '2026-11-27T10:00:00.000Z',
  allocated_cents: 0, remaining_cents: 100000, status: 'pending',
}
const financials = {
  contract: { ...contract, client_name: 'Empresa Integrada' }, installments: [installment],
  payments: [], allocations: [], receivedCents: 0, pendingCents: 100000,
}
const payment = {
  id: ids.payment, owner_id: ids.owner, contract_id: ids.contract,
  idempotency_key: '00000000-0000-4000-8000-0000000000b13', related_payment_id: null,
  type: 'receipt', amount_cents: 10000, received_at: '2026-11-27T15:00:00.000Z',
  payment_method: 'pix', notes: null, created_by: ids.owner,
  created_at: '2026-11-27T15:00:00.000Z', allocations: [], already_existed: false,
}
const expense = {
  id: ids.expense, owner_id: ids.owner, description: 'Hospedagem', category_id: null,
  amount_cents: 2500, expense_date: '2026-11-27', due_date: null, paid_at: null,
  payment_method: null, status: 'pending', project_id: ids.project, contract_id: ids.contract,
  notes: null, cancelled_at: null, created_at: '2026-11-27T10:00:00.000Z',
  updated_at: '2026-11-27T10:00:00.000Z',
}
const paidExpense = { ...expense, status: 'paid', paid_at: '2026-11-27T15:00:00.000Z', payment_method: 'pix' }
const summary = {
  contractedCents: 100000, receivedHistoricalCents: 10000, pendingCents: 90000,
  periodReceiptsCents: 10000, periodExpensesCents: 2500, periodProfitCents: 7500,
  overdueCents: 0, overdue: [], upcoming: [],
}
const report = {
  meta: {
    generatedAt: '2026-11-27T12:00:00.000Z', startDate: '2026-10-29', endDate: '2026-11-27',
    startAt: '2026-10-29T03:00:00.000Z', endAt: '2026-11-28T02:00:00.000Z',
    filters: { period: 'last_30_days' }, warnings: [],
  },
  cohort: { total: 0 },
  events: { contacts: 0, contactedLeads: 0, responses: 0, respondedLeads: 0, conversions: 0 },
  rates: {
    response: { numerator: 0, denominator: 0, value: null, sufficient: false },
    conversion: { numerator: 0, denominator: 0, value: null, sufficient: false },
  },
  series: [], byStatus: [], byNiche: [], byCity: [], byService: [], ranking: [],
}
const settings = {
  owner_id: ids.owner, service_prices: { ...DEFAULT_SETTINGS.service_prices },
  whatsapp_template: DEFAULT_SETTINGS.whatsapp_template,
  preferences: structuredClone(DEFAULT_PREFERENCES),
}
const diagnostics = {
  generatedAt: '2026-11-27T12:00:00.000Z', schemaVersion: 3,
  checks: [
    { code: 'rls.disabled', severity: 'critical', count: 1, sampleIds: ['leads'] },
    { code: 'invalid.maps_url', severity: 'warning', count: 0, sampleIds: [] },
  ],
  limits: {
    rows: 50000, zipBytes: 26214400, uncompressedBytes: 52428800,
    rpcBytes: 4194304, fieldBytes: 1048576, files: 32, columns: 64,
  },
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navigator />
      <ToastProvider><AppRoutes /></ToastProvider>
    </MemoryRouter>,
  )
}

async function go(path: string) {
  await act(async () => { navigate(path) })
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  mocks.authState.session = null
  mocks.authState.user = null
  mocks.authState.loading = false
  mocks.signIn.mockImplementation(async () => {
    mocks.authState.session = { access_token: 'mock-access-token' }
    mocks.authState.user = { id: ids.owner, email: 'owner@example.test' }
  })
  mocks.getDashboardData.mockResolvedValue(emptySnapshot)
  mocks.countOverdue.mockResolvedValue(0)
  mocks.listClients.mockResolvedValue({ clients: [], total: 0 })
  mocks.findClientDuplicateCandidates.mockResolvedValue([])
  mocks.createClient.mockResolvedValue(client)
  mocks.getClient.mockResolvedValue(clientDetail)
  mocks.listProjectFormOptions.mockResolvedValue({
    clients: [{ id: ids.client, name: client.name }],
    contracts: [{ id: ids.contract, client_id: ids.client, service: 'Site', total_value_cents: 100000,
      allocated_cents: 0, remaining_cents: 100000, due_date: '2026-12-27' }],
  })
  mocks.createProject.mockResolvedValue(project)
  mocks.getProject.mockImplementation(async () => projectDetail)
  mocks.listTasks.mockImplementation(async () => projectDetail.tasks)
  mocks.updateTask.mockImplementation(async (_id: string, input: { status: string }) => {
    task = { ...task, status: input.status, completed_at: input.status === 'completed' ? '2026-11-27T12:00:00.000Z' : null }
    projectDetail = {
      ...projectDetail, tasks: [task], progressPercent: input.status === 'completed' ? 100 : 0,
      completedTasks: input.status === 'completed' ? 1 : 0,
      activities: [{ id: '00000000-0000-4000-8000-0000000000f02', owner_id: ids.owner,
        client_id: ids.client, project_id: ids.project, contract_id: ids.contract,
        type: 'status_change', description: 'Tarefa concluída: Layout', metadata: {},
        created_by: ids.owner, created_at: '2026-11-27T12:00:00.000Z' }],
    }
    return task
  })
  mocks.listRevisions.mockResolvedValue([])
  mocks.listContracts.mockResolvedValue([{ ...contract, client_name: client.name }])
  mocks.getContractFinancials.mockResolvedValue(financials)
  mocks.recordPayment.mockResolvedValue(payment)
  mocks.listExpenses.mockResolvedValue([])
  mocks.listCategories.mockResolvedValue([])
  mocks.createExpense.mockResolvedValue(expense)
  mocks.payExpense.mockResolvedValue(paidExpense)
  mocks.getFinancialSummary.mockResolvedValue(summary)
  mocks.getCashFlow.mockResolvedValue([])
  mocks.getExpenseCategoryTotals.mockResolvedValue([])
  mocks.loadReportData.mockResolvedValue(report)
  mocks.getReportFilterOptions.mockResolvedValue({ cities: ['São Paulo'], services: ['Site'] })
  mocks.exportReport.mockResolvedValue({ csv: 'coluna\nvalor\n', fileName: 'relatorio.csv', total: 0 })
  mocks.getSettings.mockResolvedValue(settings)
  mocks.getProfileName.mockResolvedValue('Maria')
  mocks.saveSettings.mockResolvedValue(settings)
  mocks.saveConfiguration.mockResolvedValue(settings)
  mocks.updateProfileName.mockResolvedValue(undefined)
  mocks.getDiagnostics.mockResolvedValue(diagnostics)
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => '00000000-0000-4000-8000-0000000000b14') })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:report') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({
    length: 1,
    item: () => new DOMRect(0, 0, 100, 20),
    [Symbol.iterator]: function* () { yield new DOMRect(0, 0, 100, 20) },
  } as DOMRectList)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('IntegratedJourney', () => {
  it('redireciona rota privada, autentica e mostra o dashboard vazio', async () => {
    const view = renderApp('/clientes')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'owner@example.test' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-ficticia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('owner@example.test', 'senha-ficticia'))

    view.rerender(
      <MemoryRouter initialEntries={['/login']}>
        <Navigator /><ToastProvider><AppRoutes /></ToastProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(await screen.findByText('Seu CRM está pronto para começar')).toBeTruthy()
  })

  it('percorre clientes, projetos, financeiro, relatorios, configuracoes e backup com servicos mockados', async () => {
    mocks.authState.session = { access_token: 'mock-access-token' }
    mocks.authState.user = { id: ids.owner, email: 'owner@example.test' }
    renderApp('/')
    expect(await screen.findByText('Seu CRM está pronto para começar')).toBeTruthy()

    await go('/clientes')
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }))
    fireEvent.change(await screen.findByLabelText('Nome do cliente *'), { target: { value: client.name } })
    fireEvent.change(screen.getByLabelText('Serviço contratado *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor contratado *'), { target: { value: '1.000,00' } })
    fireEvent.change(screen.getByLabelText('Data da contratação *'), { target: { value: '2026-11-27' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar cliente' }))
    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({
      name: client.name, initialContract: expect.objectContaining({ totalValueCents: 100000 }),
    })))
    expect(await screen.findByRole('heading', { name: client.name })).toBeTruthy()

    await go('/projetos/novo')
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: ids.client } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: ids.contract } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: project.name } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledWith(expect.objectContaining({
      clientId: ids.client, contractId: ids.contract, contractedValueCents: 100000,
    })))
    expect(await screen.findByRole('heading', { name: project.name })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))
    expect(await screen.findByText('Layout')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(mocks.updateTask).toHaveBeenCalledWith(ids.task, expect.objectContaining({ status: 'completed' })))
    await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Progresso de tarefas' }).getAttribute('aria-valuenow')).toBe('100'))
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(await screen.findByText('Tarefa concluída: Layout')).toBeTruthy()

    await go('/financeiro')
    expect(await screen.findByRole('heading', { name: 'Visão financeira' })).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Recebimentos do período' })).getByText(/100,00/).textContent).toContain('100,00')
    expect(within(screen.getByRole('group', { name: 'Despesas pagas do período' })).getByText(/25,00/).textContent).toContain('25,00')
    expect(within(screen.getByRole('group', { name: 'Lucro do período' })).getByText(/75,00/).textContent).toContain('75,00')
    fireEvent.click(screen.getByRole('button', { name: 'Receitas' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Receber' }))
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '100,00' } })
    fireEvent.change(screen.getByLabelText('Alocação parcela 1'), { target: { value: '100,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }))
    await waitFor(() => expect(mocks.recordPayment).toHaveBeenCalledWith(ids.contract, expect.objectContaining({
      amountCents: 10000, allocations: [{ installmentId: ids.installment, amountCents: 10000 }],
    })))

    mocks.listExpenses.mockResolvedValueOnce([]).mockResolvedValueOnce([expense]).mockResolvedValue([paidExpense])
    fireEvent.click(screen.getByRole('button', { name: 'Despesas' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Nova despesa' }))
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: expense.description } })
    fireEvent.change(screen.getByLabelText('Valor (R$) *'), { target: { value: '25,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar despesa' }))
    await waitFor(() => expect(mocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 2500 })))
    fireEvent.click(await screen.findByRole('button', { name: 'Pagar despesa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(mocks.payExpense).toHaveBeenCalledWith(ids.expense, expect.any(String), 'pix'))

    await go('/relatorios')
    expect(await screen.findByRole('heading', { name: 'Relatórios' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-11-27' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'São Paulo' } })
    await waitFor(() => expect(mocks.loadReportData).toHaveBeenLastCalledWith('prospecting', expect.objectContaining({
      period: 'custom', startDate: '2026-11-01', endDate: '2026-11-27', city: 'São Paulo',
    })))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(mocks.exportReport).toHaveBeenCalledWith('leads', expect.objectContaining({
      period: 'custom', startDate: '2026-11-01', endDate: '2026-11-27', city: 'São Paulo',
    }), expect.any(Function)))

    await go('/configuracoes')
    expect(await screen.findByRole('heading', { name: 'Configurações' })).toBeTruthy()
    fireEvent.change(await screen.findByDisplayValue('Maria'), { target: { value: 'Maria Integrada' } })
    fireEvent.change(screen.getByLabelText('Nome da empresa'), { target: { value: 'Ber Integrado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }))
    await waitFor(() => expect(mocks.saveConfiguration).toHaveBeenCalledWith(
      'Maria Integrada', expect.any(Object), expect.any(String),
      expect.objectContaining({ company: expect.objectContaining({ name: 'Ber Integrado' }) }),
      true,
    ))
    expect(mocks.saveSettings).not.toHaveBeenCalled()
    expect(mocks.updateProfileName).not.toHaveBeenCalled()
    expect(JSON.stringify(mocks.saveConfiguration.mock.calls[0])).not.toContain('"role"')

    const publicError = Object.assign(new Error('Diagnóstico indisponível.'), {
      cause: new Error('backend secret detail'),
    })
    mocks.getDiagnostics.mockRejectedValueOnce(publicError).mockResolvedValue(diagnostics)
    await go('/backup')
    expect((await screen.findByRole('alert')).textContent).toContain('Diagnóstico indisponível.')
    expect(document.body.textContent).not.toContain('backend secret detail')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar diagnóstico novamente' }))
    expect((await screen.findByText(/^rls\.disabled/)).textContent).toContain('critical')
    expect(screen.getByText('Amostras: leads').textContent).toBe('Amostras: leads')
    expect(screen.queryByText(/^invalid\.maps_url/)).toBeNull()
    expect(mocks.restoreBackup).not.toHaveBeenCalled()
  })

  it('descarta resposta de dashboard que termina depois da troca de rota', async () => {
    mocks.authState.session = { access_token: 'mock-access-token' }
    mocks.authState.user = { id: ids.owner, email: 'owner@example.test' }
    let resolveDashboard!: (value: typeof emptySnapshot) => void
    mocks.getDashboardData.mockReturnValue(new Promise((resolve) => { resolveDashboard = resolve }))
    renderApp('/')
    await waitFor(() => expect(mocks.getDashboardData).toHaveBeenCalledTimes(1))
    await go('/clientes')
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeTruthy()
    await act(async () => { resolveDashboard(emptySnapshot) })
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeTruthy()
    expect(screen.queryByText('Seu CRM está pronto para começar')).toBeNull()
  })

  it('mantem foco e nomes acessiveis no menu mobile sem controles interativos aninhados', async () => {
    mocks.authState.session = { access_token: 'mock-access-token' }
    mocks.authState.user = { id: ids.owner, email: 'owner@example.test' }
    vi.stubGlobal('innerWidth', 390)
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    const opener = screen.getByRole('button', { name: 'Abrir menu' })
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Menu de navegação' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar menu' }))
    expect(dialog.querySelector('a button, button a')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Menu de navegação' })).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/pages/IntegratedJourney.test.tsx
```

Expected RED until all WP0–WP4 routes/services are integrated. Fix integration defects in their owning files; do not replace real pages with test-only stubs in production. If a selector changes in an owning page, update this literal test to the real accessible name rather than weakening the assertion.

- [ ] **Step 2: Add Playwright and scripts.**

During execution, run:

```bash
npm install --save-dev @playwright/test@^1.56.1
```

Then set these scripts in `package.json` while preserving every existing script/dependency:

```json
{
  "test": "vitest run",
  "test:e2e": "playwright test",
  "build": "tsc -b && vite build",
  "lint": "oxlint"
}
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://mock-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'mock-public-anon-key',
    },
  },
})
```

The fake key is deliberately not a credential and grants no access. No `.env.local`, service-role key or real Supabase project is used.

- [ ] **Step 3: Write the local mocked browser smoke.**

Create `e2e/journey.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

const ownerId = '00000000-0000-0000-0000-0000000000d01'
const accessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: ownerId, exp: 9_999_999_999 })).toString('base64url'),
  'c2lnbmF0dXJl',
].join('.')
const emptySnapshot = {
  generatedAt: '2026-11-26T12:00:00.000Z',
  indicators: {
    totalLeads: 0, novos: 0, contatados: 0, interessados: 0, negociando: 0,
    convertidos: 0, totalOportunidades: 0, altaPrioridade: 0,
    followupsPendentes: 0, followupsAtrasados: 0,
  },
  byMonth: [], byNiche: [], byStatus: [], byPriority: [], funnel: [],
  pendingFollowups: [], recentActivities: [], recentStatusChanges: [], recentLeads: [],
}

async function seedSession(page: Page) {
  await page.addInitScript(({ id, token }) => {
    const session = {
      access_token: token,
      refresh_token: 'mock-refresh-token',
      expires_at: 9999999999,
      expires_in: 9999999999,
      token_type: 'bearer',
      user: {
        id,
        email: 'owner@example.test',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: '2026-11-26T12:00:00.000Z',
      },
    }
    localStorage.setItem('sb-mock-project-auth-token', JSON.stringify(session))
  }, { id: ownerId, token: accessToken })
}

async function mockSupabase(page: Page) {
  const calls = { dashboard: 0, diagnostics: 0, unmatched: 0 }
  await page.route('https://mock-project.supabase.co/**', (route) => {
    calls.unmatched += 1
    return route.abort('blockedbyclient')
  })
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    json: [],
    headers: { 'content-range': '0-0/0', 'content-type': 'application/json' },
  }))
  await page.route('**/auth/v1/health', (route) => route.fulfill({ json: { ok: true } }))
  await page.route('**/auth/v1/logout', (route) => route.fulfill({ status: 204 }))
  await page.route('**/auth/v1/recover', (route) => route.fulfill({ json: {} }))
  await page.route('**/auth/v1/user', (route) => route.fulfill({
    json: { id: ownerId, email: 'owner@example.test', aud: 'authenticated', role: 'authenticated' },
  }))
  await page.route('**/auth/v1/token**', (route) => route.fulfill({
    json: {
      access_token: accessToken,
      refresh_token: 'mock-refresh-token',
      expires_at: 9999999999,
      expires_in: 9999999999,
      token_type: 'bearer',
      user: { id: ownerId, email: 'owner@example.test', aud: 'authenticated', role: 'authenticated' },
    },
  }))
  await page.route('**/rest/v1/rpc/get_dashboard_snapshot', (route) => {
    calls.dashboard += 1
    return route.fulfill({ json: emptySnapshot })
  })
  await page.route('**/rest/v1/rpc/diagnose_data_integrity', (route) => {
    calls.diagnostics += 1
    return route.fulfill({ json: {
      generated_at: '2026-11-27T12:00:00.000Z',
      schema_version: 3,
      checks: [{ code: 'rls.disabled', severity: 'critical', count: 0, sample_ids: [] }],
      limits: {
        rows: 50000, zipBytes: 26214400, uncompressedBytes: 52428800,
        rpcBytes: 4194304, fieldBytes: 1048576, files: 32, columns: 64,
      },
    } })
  })
  return calls
}

test('private route redirects and recovery uses a non-enumerating message', async ({ page }) => {
  const calls = await mockSupabase(page)
  await page.goto('/clientes')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail').fill('owner@example.test')
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado')
  expect(calls.unmatched).toBe(0)
})

test('authenticated module journey stays usable without horizontal overflow', async ({ page }) => {
  await seedSession(page)
  const calls = await mockSupabase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Seu CRM está pronto para começar')).toBeVisible()
  expect(calls.dashboard).toBeGreaterThan(0)

  for (const path of ['/clientes', '/projetos', '/financeiro', '/relatorios', '/configuracoes', '/backup']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, `overflow horizontal em ${path}`).toBe(false)
  }
  expect(calls.diagnostics).toBeGreaterThan(0)
  expect(calls.unmatched).toBe(0)

  if (await page.getByRole('button', { name: 'Abrir menu' }).isVisible()) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused()
  }
})

test('logout clears private client drafts', async ({ page }) => {
  await seedSession(page)
  const calls = await mockSupabase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  expect(calls.dashboard).toBeGreaterThan(0)
  await page.evaluate((id) => sessionStorage.setItem(`ber-crm:client-draft:v1:${id}:scope`, 'PII'), ownerId)
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  const draft = await page.evaluate((id) => sessionStorage.getItem(`ber-crm:client-draft:v1:${id}:scope`), ownerId)
  expect(draft).toBeNull()
  expect(calls.unmatched).toBe(0)
})
```

- [ ] **Step 4: Install the browser and run the smoke locally.**

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: mobile and desktop projects pass; the dashboard and diagnostics handlers were called; `unmatched` stays zero so no Supabase request escapes interception; no horizontal overflow; mobile drawer traps/returns focus; logout removes drafts. A jsdom pass alone is not browser evidence.

- [ ] **Step 5: Verify and commit.**

```bash
npm test -- --maxWorkers=2 src/pages/IntegratedJourney.test.tsx
npm run test:e2e
git add src/pages/IntegratedJourney.test.tsx playwright.config.ts e2e/journey.spec.ts package.json package-lock.json
git commit -m "test: cobrir jornada integrada e responsividade"
```

---

### Task 9: Add Node 24 CI and Vercel security headers

**Files:**

- Create: `.github/workflows/ci.yml`
- Modify: `vercel.json`
- Modify: `.gitignore` only if Playwright artifacts are not already ignored.
- Modify: `.env.example` only to document public variables; never add a real key.

**Interfaces:**

- Public CI has `contents: read`, Node 24, `npm ci`, tests with `--maxWorkers=2`, lint and build.
- Browser smoke is a separate job with a locally installed Chromium and fake public environment.
- No `SUPABASE_DB_URL`, service-role key, Vercel token or real Auth credential is available to CI.

- [ ] **Step 1: Write the CI workflow.**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Node 24 quality gate
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test -- --maxWorkers=2
      - run: npm run lint
      - run: npm run build

  browser-smoke:
    name: Node 24 mocked browser smoke
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Add production security headers and keep the SPA rewrite.**

Replace `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" }
      ]
    }
  ]
}
```

Do not add `unsafe-eval` or a wildcard `connect-src`. If a future self-hosted Supabase URL is used, document the exact additional host rather than weakening the policy globally.

- [ ] **Step 3: Ignore generated browser artifacts.**

Ensure `.gitignore` contains:

```gitignore
playwright-report/
test-results/
blob-report/
```

Keep `.env.local` ignored. `.env.example` remains:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Validate configuration statically and commit.**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json valido')"
node -e "const fs=require('fs'); const y=fs.readFileSync('.github/workflows/ci.yml','utf8'); if(!y.includes('node-version: 24')||!y.includes('npm test -- --maxWorkers=2')||!y.includes('npm run lint')||!y.includes('npm run build')) process.exit(1); console.log('gate CI conferido')"
git diff --check
git add .github/workflows/ci.yml vercel.json .gitignore .env.example
git commit -m "ci: adicionar gate Node 24 e headers de seguranca"
```

Expected: no secret reference in the workflow. Actual Actions execution remains unclaimed until a fresh run is observed.

---

### Task 10: Replace outdated README and create database/deployment documentation

**Files:**

- Modify: `README.md`
- Create: `docs/supabase-schema.md`
- Create: `docs/vercel-deploy.md`

**Interfaces:**

- Documentation states Node 24, migrations `0001`–`0013`, Auth/RLS/audit/diagnostics, local/CI commands, free-tier limitations and external dependencies.
- No credential, private URL, token or unverified runtime claim.

- [ ] **Step 1: Replace README.md.**

Use this complete content, updating only evidence-backed status lines after the final gate:

```md
# Ber CRM Free

CRM privado de prospecção, clientes, projetos e financeiro. Interface em português, dark mode grafite, dados reais no Supabase e sem backend adicional.

## Stack

- React 19, TypeScript, Vite 8 e Tailwind CSS v4
- React Router 7
- Supabase Free: PostgreSQL, Auth e RLS
- Recharts, DnD Kit e Lucide
- Vitest, Testing Library e Playwright para smoke local mockado

## Pré-requisitos

- Node.js 24 e npm
- Conta Supabase Free
- Projeto Supabase com Auth por e-mail/senha

## Instalação

```bash
npm ci
cp .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave pública anon/publishable. Nunca use service role key no frontend ou em CI público.

```bash
npm run dev
```

Abra o endereço informado pelo Vite. Sem configuração, rotas privadas direcionam para `/status`.

## Banco e migrations

Aplique `supabase/migrations/0001_profiles.sql` até `0013_etapa3_security_audit.sql`, em ordem, pelo processo autorizado. Não edite migrations antigas. `0010`–`0012` são dependências de Relatórios, Configurações e Backup. `0012`/`get_backup_diagnostics()` é a dona da matriz completa de diagnóstico; `0013` é segurança, auditoria, performance e expõe `diagnose_data_integrity()` somente como adaptador read-only desse contrato.

Detalhes de tabelas, RLS, grants, FKs compostas, auditoria e manutenção estão em [`docs/supabase-schema.md`](docs/supabase-schema.md).

## Autenticação

- Contas são criadas pelo administrador no painel Supabase.
- Login, logout, persistência, expiração e recuperação usam Supabase Auth.
- Configure a URL de retorno da recuperação como `https://SEU-DOMINIO/login?mode=recovery` e `http://localhost:5173/login?mode=recovery` no ambiente correspondente.
- O CRM não armazena senhas.
- `profiles.role` não pode ser alterado pelo próprio usuário; somente `full_name` recebe UPDATE direto.

## Testes e qualidade

```bash
npm test -- --maxWorkers=2
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

O smoke Playwright usa URL/chave públicas fictícias e intercepta a rede; não acessa um projeto real. A cobertura de RLS com dois proprietários reais é um procedimento manual separado e só é considerada concluída com evidência.

## Funcionalidades

- Leads, oportunidades, pipeline e follow-ups
- Clientes, vínculos e conversão explícita
- Projetos, tarefas, revisões e entregas
- Contratos, parcelas, pagamentos, estornos e despesas
- Relatórios com filtros e exportações CSV protegidas
- Configurações versionadas e preferências
- Backup manual com manifesto, prévia e restore transacional
- Diagnóstico read-only de integridade
- Auditoria append-only de eventos importantes

Dinheiro canônico de Financeiro usa centavos inteiros no TypeScript e `numeric(14,2)` no PostgreSQL. Contratado, recebido, estimado e pendente são métricas separadas. Datas de relatório seguem `America/Sao_Paulo`.

## Segurança

RLS é a autoridade final. Toda tabela privada é dono-escopada. Leituras usam `security invoker`; escritas sensíveis usam RPCs/triggers `security definer` com `search_path = ''`. `audit_events` permite somente SELECT ao proprietário; INSERT/UPDATE/DELETE diretos são revogados e a escrita é transacional por trigger/RPC. Metadados são mínimos e allowlisted; senhas, tokens e payloads brutos não são auditados.

O diagnóstico não corrige nem exclui dados. Correções destrutivas exigem backup, confirmação e procedimento separado.

## Limitações do Free

- Backup manual não substitui backup gerenciado do banco.
- Free tiers têm limites de banco, Auth, banda e execução; não há SLA implícito.
- Não há WhatsApp API, scraping abusivo, enriquecimento pago, APIs pagas, Edge Functions ou service role no cliente.
- Migrations, RLS real entre dois usuários, persistência autenticada e publicação são `dependentes de configuração externa` até serem executadas e evidenciadas.

## Deploy

Siga [`docs/vercel-deploy.md`](docs/vercel-deploy.md). Nenhum deploy ou publicação ocorre sem autorização específica.
```

- [ ] **Step 2: Create docs/supabase-schema.md.**

```md
# Schema Supabase — Ber CRM Free

## Ordem e autoridade

Aplique `0001`–`0013` em ordem. O design autorizado é `docs/superpowers/specs/2026-11-26-etapa3-finalizacao-design.md`. Migrations são aditivas; nunca reescreva histórico.

## Identidade e perfis

- `auth.users`: identidade Supabase; o CRM não guarda senha.
- `profiles(id, full_name, role, created_at, updated_at)`: um perfil por usuário.
- `handle_new_user()` cria o perfil com `security definer` e `search_path = ''`.
- `authenticated` tem SELECT e UPDATE apenas da coluna `full_name`; role exige administração fora do cliente.

## Tabelas de negócio

| Grupo | Tabelas |
|---|---|
| Prospecção | `leads`, `lead_activities`, `lead_followups`, `lead_digital_checks` |
| Clientes | `clients`, `lead_client_links`, `contracts`, `projects`, `client_activities` |
| Projetos | `project_tasks`, `project_revisions` |
| Financeiro | `expense_categories`, `contract_installments`, `financial_payments`, `financial_payment_allocations`, `financial_expenses` |
| Configurações | `user_settings` e tabelas/preferências introduzidas por `0011` |
| Backup | manifesto/restore introduzidos por `0012` |
| Segurança | `audit_events` |

## Relacionamentos e integridade

- Toda tabela privada tem `owner_id` e RLS por `auth.uid() = owner_id`.
- Filhos de lead usam FK composta `(owner_id, lead_id) -> leads(owner_id,id)`.
- Clientes, contratos, projetos, tarefas, revisões, parcelas, pagamentos, alocações e despesas usam FKs compostas de dono/entidade.
- `owner_id` é imutável por trigger.
- Checks cobrem dinheiro não negativo, datas, status, cancelamento/conclusão e timestamps relacionados.
- A migration `0013` faz preflight e aborta se encontrar órfãos/donos incompatíveis/valores inválidos; não corrige dados automaticamente.

## Dinheiro e datas

- Financeiro canônico: centavos inteiros no TypeScript; `numeric(14,2)` no PostgreSQL.
- Receita realizada = pagamentos receipt menos refunds; `leads.received_value` não alimenta caixa/lucro.
- Contratado, recebido, pendente, estimado e despesas permanecem separados.
- Agrupamentos usam `America/Sao_Paulo`, início inclusivo e fim exclusivo.
- Campos legados de leads são decimais conforme Plano 1; não os some ao ledger canônico.

## RLS, grants e funções

- `authenticated` recebe o mínimo necessário; tabelas financeiras e históricos importantes têm somente SELECT.
- Escritas sensíveis passam por RPCs validadas.
- Leituras são `security invoker`; views devem usar `security_invoker = true`.
- Escritas sensíveis são `security definer` com `search_path = ''` e objetos qualificados.
- Funções de trigger e o writer de auditoria não têm EXECUTE para clientes.

## Auditoria append-only

`audit_events` contém `owner_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` e `created_at`.

- Somente SELECT dono-escopado para `authenticated`.
- INSERT direto revogado; UPDATE/DELETE/TRUNCATE bloqueados por trigger.
- Escrita por `write_audit_event()` chamada por triggers/RPCs.
- Metadados limitados a chaves allowlisted e 2 KB; sem senha, token, chave ou payload bruto.
- Uma falha de auditoria reverte a operação principal na mesma transação.
- Restore chama o writer explicitamente antes do sucesso transacional.

## Diagnóstico e performance

- `get_backup_diagnostics()` é a dona canônica do diagnóstico completo: `security definer`, `stable`, `search_path = ''`, com filtro explícito por `auth.uid()` em todas as leituras. Ela detecta órfãos, duplicidades, valores/datas/status inválidos, saldos/alocações/estornos divergentes e donos incompatíveis sem corrigir dados.
- `diagnose_data_integrity()` é um adaptador `security invoker`, `stable`, `search_path = ''`, que delega a `get_backup_diagnostics()` e preserva o mesmo JSON (`schema_version = 3`, `checks`, `limits`). O cliente usa esse adaptador; não existe um segundo serviço/UI de diagnóstico.
- `get_dashboard_snapshot()` agrega no servidor.
- `list_followups_cursor()`, `list_lead_followups_cursor()` e `list_lead_activities_cursor()` usam ordenação estável `(data,id)`.
- Relatórios/exports usam cursor e páginas de até 1.000 registros; limite excedido aborta sem parcial como completo.
- Índices cobrem dono, data, status, nicho, cidade, serviço, vencimento e FKs frequentes.

## Testes e manutenção

```bash
npm test -- --maxWorkers=2
npm run lint
npm run build
npm run test:e2e
```

`supabase/tests/etapa3_security.sql` é transacional e usa JWT sintético. `supabase/tests/etapa3_two_owners_manual.sql` exige dois usuários reais e execução autenticada autorizada. Não execute testes destrutivos em produção.

Antes de uma migration nova:

1. Gere backup e valide o manifesto.
2. Execute o diagnóstico e resolva Bloqueios Critical/Important.
3. Revise RLS/grants/search_path/FKs/checks.
4. Teste em ambiente descartável com dois donos.
5. Aplique por processo autorizado e registre evidência.

Contas Supabase Free têm limites e não substituem backup gerenciado. Migrations, RLS runtime e publicação só são `concluídas/testadas` com evidência real.
```

- [ ] **Step 3: Create docs/vercel-deploy.md.**

```md
# Deploy Vercel Hobby — Ber CRM Free

## Autorização

Este documento prepara o deploy. Não faça push, deploy, SQL remoto ou publicação sem autorização específica.

## Configuração do projeto

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 24
- Rewrite SPA: já definido em `vercel.json`
- Headers de segurança: já definidos em `vercel.json`

## Variáveis públicas

Configure no projeto Vercel:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
```

Nunca configure service role key, segredo de banco, token de Auth ou chave privada. Variáveis `VITE_*` são públicas por natureza.

## Supabase Auth

1. Aplique `0001`–`0013` pelo processo autorizado.
2. Em Auth URL Configuration, adicione o Site URL e a URL de retorno:
   - `https://SEU-DOMINIO/login?mode=recovery`
   - `http://localhost:5173/login?mode=recovery` para desenvolvimento
3. Configure provedor e-mail/senha e confirmação conforme a política do projeto.
4. Crie usuários de teste reais A/B para a validação de isolamento.

## Banco

Não aplique migrations pelo navegador de produção sem backup e autorização. `0013` aborta em dados inválidos e não faz reparo automático. Registre a versão aplicada e execute o diagnóstico read-only.

## Gate antes de publicar

```bash
npm ci
npm test -- --maxWorkers=2
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

O CI Node 24 executa testes, lint, build e smoke browser mockado. O smoke não prova RLS real.

## Checklist de publicação autorizada

- [ ] Variáveis públicas configuradas; nenhum segredo no bundle.
- [ ] `0001`–`0013` aplicadas e evidenciadas.
- [ ] Dois usuários reais validaram isolamento, persistência, logout, expiração e recuperação.
- [ ] Nenhum Bloqueio Critical/Important aberto.
- [ ] Rewrite SPA e headers verificados na URL final.
- [ ] Relatório final classificado anexado à evidência.

## Limites Hobby

Hobby tem limites de build, banda, funções e armazenamento. O projeto não usa funções/Edge Functions, API paga ou upgrade. Backup manual não substitui backup do banco. Publique somente após autorização; este plano não executa deploy.
```

- [ ] **Step 4: Verify docs and commit.**

```bash
git grep -nE 'Node\.js 20|Node 20|0001.*0005|Etapa 4' -- README.md docs/supabase-schema.md docs/vercel-deploy.md
git grep -nE 'service_role|SERVICE_ROLE|sb_secret_|sk_live_|PRIVATE KEY' -- README.md docs/supabase-schema.md docs/vercel-deploy.md .env.example
git diff --check
git add README.md docs/supabase-schema.md docs/vercel-deploy.md
git commit -m "docs: atualizar operacao schema e deploy Vercel"
```

Expected: no outdated Node/migration/Etapa 4 claim and no credential. Phrases warning against service role are allowed and must not contain an actual key.

---

### Task 11: Run the fresh final gate, self-review and classified report

**Files:**

- Read: every file changed by this plan and the final diff.
- Modify: only evidence-backed status text if the gate exposes a documentation mismatch.
- Create: no Etapa 4 and no separate report file unless the user explicitly requests one; return the classified report in the execution response.

**Interfaces:**

- Gate commands and fresh outputs.
- Finding ledger with severity, owner, status and evidence.
- Feature classification using exactly: `concluída/testada`, `implementada/não testada`, `pendente`, `dependente de configuração externa`.

- [ ] **Step 1: Run the mandatory local gate in this order.**

```bash
npm test -- --maxWorkers=2
npm run build
npm run lint
npm run test:e2e
```

Record timestamp, Node/npm versions, command, exit code and relevant output. Do not use a stale earlier pass. If a command fails, fix it and rerun the entire gate; no `--no-verify`, skipped test or suppressed lint.

After the build, inspect the emitted bundle and record actual chunk names/sizes:

```bash
find dist/assets -maxdepth 1 -type f -printf '%f %s\n' | sort
```

Expected static result: no `recharts` import in the initial Dashboard route and separate chunks for Reports, Backup and chart code. Do not claim a speed improvement without before/after measurements.

- [ ] **Step 2: Review the complete diff and security invariants.**

```bash
git diff --check
git diff --stat main...HEAD
git status --short
git grep -nE 'dangerouslySetInnerHTML|innerHTML\s*=|eval\(|new Function|service_role|SERVICE_ROLE|sb_secret_|sk_live_' -- src .github vercel.json .env.example
git grep -nE '\.range\(|listFollowups\(|listActivities\(' -- src/services src/pages
```

Expected: no untrusted HTML, secret/client elevation, unbounded extensive listing or partial export presented as complete. Any `listFollowups`/`listActivities` compatibility wrapper must have a bounded first page and must not be described as a complete history.

- [ ] **Step 3: Perform the required final self-review.**

Check each item and record `SIM`/`NÃO` with evidence:

1. Sections 10–14 and every acceptance criterion are covered.
2. Auth login/logout/recovery/persistence/expiry and route redirects have tests.
3. Every private table has RLS and least-privilege grants; no table-wide profile UPDATE remains.
4. Every sensitive definer function has empty `search_path`; no client can execute the audit writer.
5. Legacy composite owner FKs, checks and owner immutability are present; preflight never repairs data.
6. `audit_events` is append-only, owner-readable only, metadata-allowlisted and transactionally mandatory.
7. Lead/client/project/payment/refund/expense/cancellation/restore/settings audit paths are evidenced.
8. A forced audit failure proves principal rollback.
9. Diagnostics are read-only and expose no correction/delete operation.
10. Server aggregation, indexes, cursor stability and lazy chunks are evidenced; no unmeasured speed claim.
11. Integrated journey, mobile/desktop smoke, CI Node 24 and security headers pass with fresh evidence.
12. README/schema/deploy docs contain no secret or outdated stage.
13. No Critical/Important security, persistence or financial-integrity issue remains open for a finalized declaration.
14. No placeholder instruction, generated test UUID or signature mismatch remains.

Run:

```bash
set -e
placeholder_pattern='(^|[^[:alnum:]_])(TBD|TODO|TO-DO|CONTINUA|FIXME|implement later|implemente depois)([^[:alnum:]_]|$)'
generated_uuid_pattern='00000000-0000-0000-0000-0000000000(b01|c0)'
printf '%s\n' 'TODO: exemplo de placeholder real' | grep -Eq "$placeholder_pattern"
if git grep --no-index -nE "$placeholder_pattern|$generated_uuid_pattern" -- src supabase e2e .github README.md docs/supabase-schema.md docs/vercel-deploy.md .env.example vercel.json playwright.config.ts package.json; then
  exit 1
fi
```

Expected: the positive control matches, the implementation/documentation scan returns no matches, and the plan/ledger are excluded so the scanner cannot match its own pattern. In the manual probe, real user UUIDs must be supplied at execution; the static file must use named placeholders in the SQL comment only, not pretend they are real evidence.

- [ ] **Step 4: Reconcile TypeScript and SQL signatures.**

Compare every frontend `.rpc('name', args)` with `pg_proc` and the migration definition:

```text
get_dashboard_snapshot(timestamptz) -> jsonb
diagnose_data_integrity() -> jsonb
list_followups_cursor(text,timestamptz,uuid,integer) -> jsonb
list_lead_followups_cursor(uuid,timestamptz,uuid,integer) -> jsonb
list_lead_activities_cursor(uuid,timestamptz,uuid,integer) -> jsonb
write_audit_event(uuid,uuid,text,text,text,jsonb) -> uuid, trigger/RPC-only
```

Expected: exact argument names/order/defaults and no client EXECUTE on `write_audit_event`. Restore uses its actual WP4 signature and the same owner for actor/owner.

- [ ] **Step 5: Produce the classified final report in the execution response.**

Use this structure with real evidence, not prefilled success claims:

```text
BER CRM — ETAPA 3 — RELATÓRIO FINAL CLASSIFICADO
Data/commit/Node:

BLOQUEIOS
- Critical: [finding/evidence/none]
- Important: [finding/evidence/none]

FUNCIONALIDADES
- Auth e recuperação: [classificação + evidência]
- RLS/grants/perfis/search_path: [classificação + evidência]
- Integridade/FKs/checks: [classificação + evidência]
- Auditoria append-only/rollback: [classificação + evidência]
- Diagnóstico read-only: [classificação + evidência]
- Performance/cursor/lazy chunks: [classificação + evidência]
- Clientes/Projetos/Financeiro: [classificação + evidência dos Planos 1–3]
- Relatórios/CSV: [classificação + evidência de WP3]
- Configurações/Backup/restore: [classificação + evidência de WP4]
- Jornada/responsividade: [classificação + evidência]
- CI/docs/Vercel: [classificação + evidência]

DEPENDENTE DE CONFIGURAÇÃO EXTERNA
- Migrations remotas: [status]
- RLS real A/B: [status]
- Persistência/expiração Auth real: [status]
- Publicação/deploy: [status]

GATE
- npm test -- --maxWorkers=2: [resultado]
- npm run build: [resultado]
- npm run lint: [resultado]
- npm run test:e2e: [resultado]

DECLARAÇÃO
- Finalizada somente se não houver Critical/Important aberto e todos os bloqueios locais estiverem resolvidos.
- Caso contrário: conclusão parcial explícita, listando pendências e responsáveis.
```

- [ ] **Step 6: Publish/maintain only after separate authorization.**

Instructions to include in the execution handoff:

1. Apply migrations `0001`–`0013` in order after backup and diagnostic preflight.
2. Record migration versions and configure Auth return URLs.
3. Run the real two-owner checklist and retain redacted evidence.
4. Configure only public Vercel variables; verify SPA rewrite and headers.
5. Publish only with explicit user authorization; this plan does not push/deploy.
6. For maintenance, add a new additive migration, repeat RLS/grants/search_path/FK/check/audit review, run the full gate and two-owner test, and update the classified report.

- [ ] **Step 7: Final commit only if evidence-backed documentation changed.**

```bash
git add README.md docs/supabase-schema.md docs/vercel-deploy.md
git commit -m "docs: registrar evidencias e classificacao da etapa 3"
```

If no files changed, do not create an empty commit. Do not push.

---

## Plan self-review

- Spec coverage: sections 10–14 map to Tasks 1–11; no acceptance criterion is delegated to Etapa 4.
- Ownership: Planos 1–3 and parallel `0010`–`0012` are dependencies only; this plan creates only `0013`, tests, shared boundaries, CI and requested docs.
- Literal implementation: new modules, migration, tests, workflow, headers and docs are provided in full; generated-ID fixture correction is an explicit mandatory step, not an omitted implementation.
- Signatures: frontend RPC names/arguments match the SQL definitions listed in Task 11.
- Evidence: synthetic SQL, jsdom, real browser and real Supabase A/B evidence are distinguished; runtime/publication remain external until executed.
- Safety: no service role, paid API, remote SQL, push, deploy or secret is introduced.
- Finalization rule: any open Critical/Important security, persistence or financial-integrity finding forces a partial conclusion.

## Summary

Este plano finaliza a Etapa 3 existente sem recriar o projeto. Ele endurece Auth, recuperação, expiração, erros, URLs, RLS, grants, `profiles.role`, `search_path`, checks e FKs compostas por dono. A migration aditiva `0013` cria auditoria append-only com metadados mínimos e rollback transacional, expõe o diagnóstico read-only por um adaptador, agrega no servidor e adiciona índices/cursor estável; `0012`/`get_backup_diagnostics()` continua dona da matriz diagnóstica completa. O frontend passa a usar snapshot do dashboard, listas limitadas e chunks lazy para gráficos, Relatórios e Backup. Testes cobrem dois donos sintéticos, jornada integrada, responsividade mobile/desktop e smoke browser mockado. CI Node 24, headers Vercel, README, schema e deploy são atualizados. A execução depende de Planos 1–3 e dos planos paralelos `0010`–`0012`, sem editá-los. Migrations remotas, RLS real entre usuários, persistência autenticada e publicação permanecem dependentes de configuração externa até haver evidência. Nenhum Critical/Important aberto permite declarar finalização.
