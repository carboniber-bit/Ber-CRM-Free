# Etapa 3 — Segurança, Auditoria, Performance e Finalização Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and implement one task at a time. Write the failing test first where a task says RED, run only that focused test, implement the literal change, run the focused test again for GREEN, then run the task verification. Commit after each task using the command provided. Do not dispatch subagents. Do not edit `0001`–`0012`, the Planos 1–3, or the parallel Relatórios and Configurações/Backup plans. Stop if a dependency named in Task 0 is absent or its actual interface differs; reconcile the dependency in its owning plan instead of inventing a second implementation here.

**Goal:** Entregar a Etapa 3 existente com autenticação recuperável, RLS/grants mínimos, `profiles.role` não autoeditável, `search_path` seguro, integridade relacional e financeira verificável, auditoria append-only transacional, diagnóstico read-only, consultas limitadas/cursorizadas, jornada integrada responsiva, CI Node 24, documentação e relatório final classificado, sem afirmar validação runtime que não tenha evidência.

**Architecture:** React 19/TypeScript/Vite 8/Tailwind v4/React Router 7 continuam sendo a interface. Supabase Auth e o cliente browser com chave pública continuam sendo a única identidade e acesso. PostgreSQL/RLS é a autoridade final; leituras são `security invoker`, escritas sensíveis são RPCs/triggers `security definer` com `search_path = ''`. A migration aditiva `0013_etapa3_security_audit.sql` endurece privilégios e integridade, cria `audit_events`, diagnóstico e funções de performance. O frontend consome apenas RPCs/consultas dono-escopadas; Relatórios, Backup e Recharts são chunks sob demanda.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free/PostgreSQL/Auth, Recharts, Vitest 5, Testing Library/jsdom, Playwright para smoke browser local, GitHub Actions Node 24 e Vercel Hobby. Nenhuma service role key, backend novo, Edge Function, API paga ou upgrade.

**Spec:** `docs/superpowers/specs/2026-11-26-etapa3-finalizacao-design.md`, especialmente seções 10–14 e todos os critérios de aceite.

**Global Constraints:**

- Não implemente código, não execute testes/build/lint/SQL, não commite, não despache subagentes e não altere SQL remoto durante a autoria ou revisão deste plano. Os comandos abaixo são instruções para a execução futura autorizada.
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
| WP0 | Plano 1 — Clientes | Pipeline, KPI global, clientes e rotas | `docs/superpowers/plans/2026-11-25-etapa3-plano1-clientes.md`; `supabase/migrations/0006_etapa3_clients.sql`; `supabase/migrations/0007_lead_maps_url.sql`; `src/services/clientService.ts`; `src/types/client.ts`; `src/types/contract.ts` |
| WP1 | Plano 2 — Projetos | Tarefas, revisões e RPCs | `docs/superpowers/plans/2026-11-25-etapa3-plano2-projetos.md`; `supabase/migrations/0008_etapa3_projects.sql`; `src/types/project.ts` (`ProjectTask`, `ProjectTaskWrite`, `ProjectRevision`); `src/services/projectService.ts` (`listTasks`, `createTask`, `updateTask`, `reorderTasks`, `listRevisions`); `src/pages/ProjectsPage.tsx` |
| WP2 | Plano 3 — Financeiro | Ledger, RPCs, estornos e saldos | `docs/superpowers/plans/2026-11-25-etapa3-plano3-financeiro.md`; `supabase/migrations/0009_etapa3_finance.sql`; `src/types/finance.ts` (`PaymentInput`, `FinancialPayment`, `PaymentAllocation`, `FinancialExpense`); `src/services/contractService.ts` (`recordPayment`); `src/services/expenseService.ts` (`createExpense`, `payExpense`); `src/services/financialService.ts` (`getFinancialSummary`); `src/pages/FinancePage.tsx` |
| WP3 | Plano paralelo de Relatórios | Agregações canônicas e export cursorizada | `docs/superpowers/plans/2026-11-26-etapa3-relatorios.md`; `supabase/migrations/0010_etapa3_reports.sql`; `src/services/reportService.ts` (`loadReportData`, `getReportFilterOptions`, `exportReport`); `src/pages/ReportsPage.tsx`; `src/components/reports/ReportCharts.tsx` |
| WP4 | Plano paralelo de Configurações/Backup | Preferências, manifesto, prévia e restore transacional | `docs/superpowers/plans/2026-11-26-etapa3-configuracoes-backup.md`; `supabase/migrations/0011_etapa3_settings.sql`; `supabase/migrations/0012_etapa3_backup.sql`; `src/services/settingsService.ts`; `src/services/backupService.ts`; `src/pages/SettingsPage.tsx`; `src/pages/BackupPage.tsx` |
| WP5 | Este plano | Segurança, auditoria, integridade, RLS runtime e performance | `supabase/migrations/0013_etapa3_security_audit.sql`; `supabase/tests/etapa3_security.sql`; `src/services/integrityService.ts`; limites de auth/UI/consulta |
| WP6 | Este plano após WP5 | Jornada, responsividade, CI, docs e relatório | `src/pages/IntegratedJourney.test.tsx`; `playwright.config.ts`; `e2e/journey.spec.ts`; `.github/workflows/ci.yml`; `README.md`; `docs/supabase-schema.md`; `docs/vercel-deploy.md` |

Os proprietários da tabela são os caminhos exatos acima. Leia e reconcilie os arquivos, mas nunca os edite a partir deste plano. Aplique as migrations na ordem integral `0010` → `0011` → `0012` → `0013`. WP4 possui settings, backup, a página `BackupPage` e a única RPC `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`; WP5/`0013` cria exclusivamente o schema, a writer e os triggers de auditoria. A função PL/pgSQL de `0012` pode referenciar `public.write_audit_event` antes de `0013` porque a resolução interna ocorre em execução; nenhum restore ou teste de auditoria é executado antes de `0013`.

**Dependency status at authoring:** `0008`–`0012` ainda não existem no working tree atual. O plano WP4 já declara o contrato canônico abaixo; isso não substitui o gate do Task 0. A execução para quando qualquer migration, página, tipo ou serviço exacto estiver ausente ou com assinatura divergente, sem criar implementação substituta.

**Canonical audit contract:** `public.audit_events(id uuid, owner_id uuid, actor_id uuid, action text, entity_type text, entity_id text, metadata jsonb, created_at timestamptz)` e `public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid`. `entity_id` aceita UUID textual e hash de backup; `actor_id = owner_id`; `metadata` é JSON object. A writer nega EXECUTE direto a `anon`/`authenticated` e aceita exatamente as chaves/tipos da Task 3. `0011` e `0012` não criam tabela, função ou trigger de auditoria. O restore de `0012` invoca a writer canônica e pode retornar `audit_event_id` no payload; a auditoria genérica é suprimida durante `ber.restore = 'on'`, e uma falha de auditoria reverte o restore inteiro.

---

## Task 0: Establish the baseline, dependency gate and security inventory

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

- [ ] **Step 1b: Verify the WP4/WP5 boundary against the actual files.**

Read the full WP4 plan and `0012_etapa3_backup.sql`; then run:

```bash
git grep -nE '0013_etapa3_security_audit|write_audit_event|audit_events|restore_backup|audit_event_id' -- docs/superpowers/plans/2026-11-26-etapa3-configuracoes-backup.md supabase/migrations/0012_etapa3_backup.sql src/services/backupService.ts src/components/backup 2>/dev/null || true
```

Pass only if WP4 does not own/create `0013`; `0012` remains its sole `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`; restore calls `public.write_audit_event(v_owner,v_owner,'backup.restore','backup',p_restore_id,jsonb_build_object('restore_id',p_restore_id))` or obtains that UUID from its validated manifest without adding disallowed metadata; and `backupService.ts` does not require an `audit_event_id`. Otherwise stop. WP4's owner must reconcile WP4/`0012`; this plan must not edit either file.

- [ ] **Step 2: Re-read the current integration points.**

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

- [ ] **Step 3: Produce the static audit evidence.**

Run:

```bash
git grep -nE 'dangerouslySetInnerHTML|innerHTML|eval\(|new Function|service_role|serviceRole|SERVICE_ROLE|sb_secret_|sk_live_|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' -- . ':!package-lock.json'
git grep -nE 'VITE_SUPABASE_(ANON_KEY|URL)' -- src .env.example README.md
git grep -nE '\.update\(|\.delete\(|\.insert\(|\.upsert\(' -- src/services
git grep -nE '\.range\(|\.limit\(|listFollowups\(|listActivities\(' -- src/services src/pages
git grep -nE 'href=\{(lead|client|project)\.' -- src/components src/pages
```

Expected: no private key, service-role client or untrusted HTML sink. Every stored external URL rendered as `href` is listed for Task 2. Every direct mutation is matched to a table privilege and RLS policy. Every unbounded timeline/export is listed for Task 7 or the owning Reports plan. A clean pattern scan is static evidence only, not a comprehensive secret audit.

- [ ] **Step 4: Record the current static findings and owners.**

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

- [ ] **Step 5: Commit the execution baseline evidence without changing source.**

Record `BASELINE`, dependency paths and the go/no-go decision in the final-report evidence section specified by Task 11. Do not create a report Markdown file or commit an empty task solely for this inventory; continue to Task 1 only after the gate passes.

---

## Task 1: Harden authentication, recovery, expiry and private-draft cleanup

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

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir. Tente novamente.')
    expect(screen.queryByText(/JWT|secret|SELECT/i)).toBeNull()
  })

  it('rejects mismatched confirmation and a missing current password without calling Auth', () => {
    renderRecovery()
    fillPasswords()
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'diferente' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByRole('alert')).toHaveTextContent('A confirmação não coincide')
    fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'senha-segura-456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe sua senha atual.')
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
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeDisabled()
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar a senha. Tente novamente.')
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
npm run build
npm run lint
```

Expected GREEN: focused tests, TypeScript build and lint pass. Browser persistence and real recovery-link delivery remain external until Task 6.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/privateDrafts.ts src/lib/privateDrafts.test.ts src/services/authService.ts src/services/authService.test.ts src/components/auth/authContext.ts src/components/auth/AuthProvider.tsx src/components/auth/AuthProvider.test.tsx src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx
git commit -m "fix: endurecer autenticacao e recuperacao de acesso"
```

---

## Task 2: Close frontend error, URL, XSS, CSV and diagnostic boundaries

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
npm run build
npm run lint
git add src/lib/publicError.ts src/lib/publicError.test.ts src/lib/safeExternalUrl.ts src/lib/safeExternalUrl.test.tsx src/lib/csv.ts src/lib/csv.test.ts src/components/opportunities/OpportunityCard.tsx src/pages/LeadDetailPage.tsx src/pages/StatusPage.tsx src/pages/SettingsPage.tsx src/pages/DashboardPage.tsx src/services/clientService.ts src/components/ErrorBoundary.tsx
git commit -m "fix: limitar erros expostos e URLs renderizadas"
```

Expected: no untrusted HTML sink, no unsafe anchor, no raw backend detail in UI and no CSV formula regression.

---

## Task 3: Create the additive 0013 hardening, audit, diagnostics and performance migration

**Files:**

- Create: `supabase/migrations/0013_etapa3_security_audit.sql`
- Read but do not edit: `0010_etapa3_reports.sql`, `0011_etapa3_settings.sql`, `0012_etapa3_backup.sql`.

**Interfaces produced:**

```text
audit_events(id, owner_id, actor_id, action, entity_type, entity_id text, metadata, created_at)
public.write_audit_event(uuid,uuid,text,text,text,jsonb) returns uuid  -- trigger/RPC-only, no client EXECUTE
public.diagnose_data_integrity() returns table(
  generated_at timestamptz, code text, severity text,
  entity_type text, entity_id uuid, affected_count bigint, message text
)
public.list_followups_cursor(text,timestamptz,uuid,integer) returns jsonb
public.list_lead_followups_cursor(uuid,timestamptz,uuid,integer) returns jsonb
public.list_lead_activities_cursor(uuid,timestamptz,uuid,integer) returns jsonb
public.get_dashboard_snapshot(timestamptz) returns jsonb
```

- [ ] **Step 1: Inspect the actual `0012` restore function before writing the migration.**

Record the exact signature `public.restore_backup(p_package jsonb, p_preview_hash text, p_confirmation text) returns jsonb`, owner validation, transaction-local `ber.restore` scope and explicit audit calls, but do not edit `0012`. Pass only if WP4 already calls the canonical writer with `actor_id = owner_id`, uses the package SHA-256 hash as textual `entity_id` for `backup.restore`, emits one `backup.table_restored` event with `count` per restored nonempty table, and accepts/returns `audit_event_id` in its JSON result. The function may reference the writer before `0013` exists; restore execution and audit tests wait until `0013`. If incompatible, stop and return the issue to WP4's owner; never duplicate, rename or patch restore here.

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

-- ============ READ-ONLY DIAGNOSTICS ============
create or replace function public.diagnose_data_integrity()
returns table (
  generated_at timestamptz,
  code text,
  severity text,
  entity_type text,
  entity_id uuid,
  affected_count bigint,
  message text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Read-only and RLS-scoped: every source table is queried as the caller.
  -- Orphans include missing parents and parents belonging to another owner.
  return query
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'lead_activities', min(a.id), count(*),
         'Atividade sem lead dono compativel; nenhuma correcao automatica.'
  from public.lead_activities a
  left join public.leads l on l.id = a.lead_id and l.owner_id = a.owner_id
  where l.id is null group by a.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'lead_followups', min(f.id), count(*),
         'Follow-up sem lead dono compativel; nenhuma correcao automatica.'
  from public.lead_followups f
  left join public.leads l on l.id = f.lead_id and l.owner_id = f.owner_id
  where l.id is null group by f.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'lead_digital_checks', min(c.id), count(*),
         'Verificacao digital sem lead dono compativel; nenhuma correcao automatica.'
  from public.lead_digital_checks c
  left join public.leads l on l.id = c.lead_id and l.owner_id = c.owner_id
  where l.id is null group by c.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'lead_client_links', min(x.id), count(*),
         'Vinculo lead/cliente orfao ou com dono incompativel.'
  from public.lead_client_links x
  left join public.leads l on l.id = x.lead_id and l.owner_id = x.owner_id
  left join public.clients c on c.id = x.client_id and c.owner_id = x.owner_id
  where l.id is null or c.id is null group by x.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'contracts', min(k.id), count(*),
         'Contrato sem cliente ou vinculo de origem compativel.'
  from public.contracts k
  left join public.clients c on c.id = k.client_id and c.owner_id = k.owner_id
  left join public.lead_client_links x on x.id = k.source_link_id and x.owner_id = k.owner_id
  where c.id is null or (k.source_link_id is not null and x.id is null) group by k.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'projects', min(p.id), count(*),
         'Projeto sem cliente, contrato ou origem compativel.'
  from public.projects p
  left join public.clients c on c.id = p.client_id and c.owner_id = p.owner_id
  left join public.contracts k on k.id = p.contract_id and k.owner_id = p.owner_id and k.client_id = p.client_id
  left join public.lead_client_links x on x.id = p.source_link_id and x.owner_id = p.owner_id
  where c.id is null or k.id is null or (p.source_link_id is not null and x.id is null) group by p.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'client_activities', min(a.id), count(*),
         'Atividade de cliente sem cliente/projeto/contrato compativel.'
  from public.client_activities a
  left join public.clients c on c.id = a.client_id and c.owner_id = a.owner_id
  left join public.projects p on p.id = a.project_id and p.owner_id = a.owner_id and p.client_id = a.client_id
  left join public.contracts k on k.id = a.contract_id and k.owner_id = a.owner_id and k.client_id = a.client_id
  where c.id is null or (a.project_id is not null and p.id is null)
     or (a.contract_id is not null and k.id is null) group by a.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'project_tasks', min(t.id), count(*),
         'Tarefa sem projeto do mesmo dono.'
  from public.project_tasks t
  left join public.projects p on p.id = t.project_id and p.owner_id = t.owner_id
  where p.id is null group by t.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'project_revisions', min(r.id), count(*),
         'Revisao sem projeto do mesmo dono.'
  from public.project_revisions r
  left join public.projects p on p.id = r.project_id and p.owner_id = r.owner_id
  where p.id is null group by r.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'contract_installments', min(i.id), count(*),
         'Parcela sem contrato do mesmo dono.'
  from public.contract_installments i
  left join public.contracts k on k.id = i.contract_id and k.owner_id = i.owner_id
  where k.id is null group by i.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'financial_payments', min(p.id), count(*),
         'Pagamento sem contrato ou recebimento relacionado compativel.'
  from public.financial_payments p
  left join public.contracts k on k.id = p.contract_id and k.owner_id = p.owner_id
  left join public.financial_payments related on related.id = p.related_payment_id
    and related.owner_id = p.owner_id and related.contract_id = p.contract_id
  where k.id is null or (p.related_payment_id is not null and related.id is null) group by p.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'financial_payment_allocations', min(a.id), count(*),
         'Alocacao sem pagamento/parcela compativel ou com contratos divergentes.'
  from public.financial_payment_allocations a
  left join public.financial_payments p on p.id = a.payment_id and p.owner_id = a.owner_id
  left join public.contract_installments i on i.id = a.installment_id and i.owner_id = a.owner_id
  where p.id is null or i.id is null or p.contract_id <> i.contract_id
     or a.contract_id <> p.contract_id group by a.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'financial_expenses', min(e.id), count(*),
         'Despesa sem categoria/projeto/contrato compativel.'
  from public.financial_expenses e
  left join public.expense_categories c on c.id = e.category_id and c.owner_id = e.owner_id
  left join public.projects p on p.id = e.project_id and p.owner_id = e.owner_id
  left join public.contracts k on k.id = e.contract_id and k.owner_id = e.owner_id
  where (e.category_id is not null and c.id is null)
     or (e.project_id is not null and p.id is null)
     or (e.contract_id is not null and k.id is null)
     or (p.id is not null and k.id is not null and p.client_id <> k.client_id) group by e.owner_id
  union all
  select statement_timestamp(), 'LEGACY_ORPHAN', 'critical', 'user_settings', s.owner_id, count(*),
         'Configuracao sem perfil do mesmo dono.'
  from public.user_settings s
  left join public.profiles p on p.id = s.owner_id
  where p.id is null group by s.owner_id

  -- Duplicate business keys remain diagnostics even when a newer unique index exists.
  union all
  select statement_timestamp(), 'DUPLICATE_PHONE', 'important', 'leads', min(id), count(*),
         'Telefone canonico duplicado no mesmo proprietario.'
  from public.leads where phone_canonical is not null
  group by owner_id, phone_canonical having count(*) > 1
  union all
  select statement_timestamp(), 'DUPLICATE_CNPJ', 'important', 'clients', min(id), count(*),
         'CNPJ duplicado no mesmo proprietario.'
  from public.clients where cnpj_digits is not null
  group by owner_id, cnpj_digits having count(*) > 1
  union all
  select statement_timestamp(), 'DUPLICATE_CLIENT_PHONE', 'important', 'clients', min(id), count(*),
         'Telefone de cliente duplicado no mesmo proprietario.'
  from public.clients where phone_canonical is not null
  group by owner_id, phone_canonical having count(*) > 1
  union all
  select statement_timestamp(), 'DUPLICATE_CLIENT_WHATSAPP', 'important', 'clients', min(id), count(*),
         'WhatsApp de cliente duplicado no mesmo proprietario.'
  from public.clients where whatsapp_canonical is not null
  group by owner_id, whatsapp_canonical having count(*) > 1
  union all
  select statement_timestamp(), 'DUPLICATE_CATEGORY', 'important', 'expense_categories', min(id), count(*),
         'Nome de categoria duplicado no mesmo proprietario.'
  from public.expense_categories group by owner_id, lower(name) having count(*) > 1
  union all
  select statement_timestamp(), 'DUPLICATE_TASK_POSITION', 'important', 'project_tasks', min(id), count(*),
         'Posicao de tarefa duplicada no mesmo projeto.'
  from public.project_tasks group by owner_id, project_id, position having count(*) > 1
  union all
  select statement_timestamp(), 'DUPLICATE_PAYMENT_KEY', 'critical', 'financial_payments', min(id), count(*),
         'Chave de idempotencia duplicada.'
  from public.financial_payments group by idempotency_key having count(*) > 1

  -- Values and dates across legacy, project and financial domains.
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'leads', id, 1,
         'Lead contem valor monetario negativo.'
  from public.leads
  where estimated_value < 0 or negotiated_value < 0 or contracted_value < 0 or received_value < 0
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'contracts', id, 1, 'Contrato contem total negativo.'
  from public.contracts where total_value < 0
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'projects', id, 1, 'Projeto contem valor contratado negativo.'
  from public.projects where contracted_value < 0
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'contract_installments', id, 1, 'Parcela contem valor nao positivo.'
  from public.contract_installments where amount <= 0
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'financial_payments', id, 1, 'Pagamento/estorno contem valor nao positivo.'
  from public.financial_payments where amount <= 0
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'financial_payment_allocations', id, 1, 'Alocacao contem valor nao positivo.'
  from public.financial_payment_allocations where amount <= 0
  union all
  select statement_timestamp(), 'INVALID_MONEY', 'critical', 'financial_expenses', id, 1, 'Despesa contem valor negativo.'
  from public.financial_expenses where amount < 0
  union all
  select statement_timestamp(), 'INVALID_DATE', 'important', 'projects', id, 1, 'Prazo anterior ao inicio do projeto.'
  from public.projects where start_date is not null and due_date is not null and due_date < start_date
  union all
  select statement_timestamp(), 'INVALID_DATE', 'important', 'project_tasks', id, 1, 'Prazo anterior ao inicio da tarefa.'
  from public.project_tasks where start_date is not null and due_date is not null and due_date < start_date
  union all
  select statement_timestamp(), 'INVALID_DATE', 'important', 'project_revisions', id, 1, 'Conclusao anterior ao pedido da revisao.'
  from public.project_revisions where completed_at is not null and completed_at < requested_at
  union all
  select statement_timestamp(), 'INVALID_DATE', 'important', 'contracts', id, 1, 'Vencimento anterior a contratacao.'
  from public.contracts where due_date is not null and due_date < contracted_at
  union all
  select statement_timestamp(), 'INVALID_DATE', 'important', 'financial_expenses', id, 1, 'Vencimento anterior a data da despesa.'
  from public.financial_expenses where due_date is not null and due_date < expense_date

  -- Canonical status domains and timestamp/state agreement.
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'leads', id, 1, 'Status de lead fora do dominio canonico.'
  from public.leads where status not in (
    'novo','contato_realizado','aguardando_resposta','pediu_informacoes','interessado',
    'negociando','aceitou','ignorou','nao_interessado','follow_up','perdido')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'clients', id, 1, 'Status de cliente fora do dominio canonico.'
  from public.clients where status not in (
    'active','in_project','awaiting_payment','awaiting_approval','project_completed','inactive')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'projects', id, 1, 'Status de projeto fora do dominio canonico.'
  from public.projects where status not in (
    'not_started','planning','in_development','awaiting_client_info','in_review',
    'awaiting_approval','changes_requested','completed','delivered','cancelled')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'project_tasks', id, 1, 'Status de tarefa fora do dominio canonico.'
  from public.project_tasks where status not in ('pending','in_progress','completed','cancelled')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'project_revisions', id, 1, 'Status de revisao fora do dominio canonico.'
  from public.project_revisions where status not in ('requested','in_progress','completed','approved')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'contracts', id, 1, 'Status de contrato fora do dominio canonico.'
  from public.contracts where status not in ('active','cancelled')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'lead_followups', id, 1, 'Status de follow-up fora do dominio canonico.'
  from public.lead_followups where status not in ('pendente','concluido','cancelado')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'financial_payments', id, 1, 'Tipo de pagamento fora do dominio canonico.'
  from public.financial_payments where type not in ('receipt','refund')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'financial_expenses', id, 1, 'Status de despesa fora do dominio canonico.'
  from public.financial_expenses where status not in ('pending','paid','cancelled')
  union all
  select statement_timestamp(), 'INVALID_STATUS', 'important', 'lead_digital_checks', id, 1, 'Status de verificacao digital fora do dominio canonico.'
  from public.lead_digital_checks
  where has_website not in ('yes','no','unverified') or has_instagram not in ('yes','no','unverified')
     or has_facebook not in ('yes','no','unverified') or has_digital_menu not in ('yes','no','unverified')
     or has_digital_catalog not in ('yes','no','unverified') or has_landing_page not in ('yes','no','unverified')
     or has_business_whatsapp not in ('yes','no','unverified')
  union all
  select statement_timestamp(), 'INVALID_FOLLOWUP_STATE', 'important', 'lead_followups', id, 1, 'Estado do follow-up diverge de completed_at.'
  from public.lead_followups
  where (status = 'concluido' and completed_at is null) or (status <> 'concluido' and completed_at is not null)
  union all
  select statement_timestamp(), 'INVALID_TASK_STATE', 'important', 'project_tasks', id, 1, 'Timestamps de tarefa divergem do status.'
  from public.project_tasks
  where (status = 'completed' and completed_at is null) or (status <> 'completed' and completed_at is not null)
     or (status = 'cancelled' and cancelled_at is null) or (status <> 'cancelled' and cancelled_at is not null)
  union all
  select statement_timestamp(), 'INVALID_REVISION_STATE', 'important', 'project_revisions', id, 1, 'Timestamps de revisao divergem do status.'
  from public.project_revisions
  where (status = 'completed' and completed_at is null) or (status not in ('completed','approved') and completed_at is not null)
     or (status = 'approved' and (approved_at is null or completed_at is null))
     or (status <> 'approved' and approved_at is not null)
  union all
  select statement_timestamp(), 'INVALID_CONTRACT_STATE', 'important', 'contracts', id, 1, 'Cancelamento e cancelled_at divergentes.'
  from public.contracts where (status = 'cancelled' and cancelled_at is null)
     or (status <> 'cancelled' and cancelled_at is not null)
  union all
  select statement_timestamp(), 'INVALID_EXPENSE_STATE', 'important', 'financial_expenses', id, 1, 'Pagamento/cancelamento e timestamps divergentes.'
  from public.financial_expenses
  where (status = 'paid' and paid_at is null) or (status <> 'paid' and paid_at is not null)
     or (status = 'cancelled' and cancelled_at is null) or (status <> 'cancelled' and cancelled_at is not null)
  union all
  select statement_timestamp(), 'INVALID_DIGITAL_CHECK', 'important', 'lead_digital_checks', id, 1, 'Verified e verified_at divergentes.'
  from public.lead_digital_checks where (verified and verified_at is null) or (not verified and verified_at is not null)
  union all
  select statement_timestamp(), 'INVALID_SETTINGS', 'important', 'user_settings', owner_id, 1, 'service_prices nao e um objeto de valores nao negativos.'
  from public.user_settings where not public.validate_service_prices(service_prices)

  -- Owner fields written by trusted code must still identify the row owner.
  union all
  select statement_timestamp(), 'OWNER_INCOMPATIBLE', 'critical', 'client_activities', id, 1, 'created_by difere do owner_id.'
  from public.client_activities where created_by is not null and created_by <> owner_id
  union all
  select statement_timestamp(), 'OWNER_INCOMPATIBLE', 'critical', 'financial_payments', id, 1, 'created_by difere do owner_id.'
  from public.financial_payments where created_by is not null and created_by <> owner_id

  -- Payment, allocation, installment, project and refund balances. Under-allocation
  -- of an installment is a valid pending balance; over-allocation is not.
  union all
  select statement_timestamp(), 'PAYMENT_ALLOCATION_DIVERGENCE', 'critical', 'financial_payments', p.id, 1, 'Soma das alocacoes difere do valor do pagamento.'
  from public.financial_payments p
  left join public.financial_payment_allocations a on a.payment_id = p.id and a.owner_id = p.owner_id
  group by p.owner_id, p.id, p.amount having coalesce(sum(a.amount), 0) <> p.amount
  union all
  select statement_timestamp(), 'INSTALLMENT_OVERALLOCATED', 'critical', 'contract_installments', i.id, 1, 'Alocacoes liquidas excedem a parcela.'
  from public.contract_installments i
  left join public.financial_payment_allocations a on a.installment_id = i.id and a.owner_id = i.owner_id
  left join public.financial_payments p on p.id = a.payment_id and p.owner_id = i.owner_id
  group by i.owner_id, i.id, i.amount
  having coalesce(sum(case when p.type = 'refund' then -a.amount else a.amount end), 0) > i.amount
  union all
  select statement_timestamp(), 'INSTALLMENT_TOTAL_DIVERGENCE', 'critical', 'contracts', c.id, 1, 'Soma das parcelas difere do total ativo do contrato.'
  from public.contracts c
  left join public.contract_installments i on i.contract_id = c.id and i.owner_id = c.owner_id
  where c.status = 'active' group by c.owner_id, c.id, c.total_value
  having count(i.id) > 0 and coalesce(sum(i.amount), 0) <> c.total_value
  union all
  select statement_timestamp(), 'CONTRACT_OVERPAID', 'critical', 'contracts', c.id, 1, 'Recebimentos liquidos excedem o total do contrato.'
  from public.contracts c
  left join public.financial_payments p on p.contract_id = c.id and p.owner_id = c.owner_id
  where c.status = 'active' group by c.owner_id, c.id, c.total_value
  having coalesce(sum(case when p.type = 'refund' then -p.amount else p.amount end), 0) > c.total_value
  union all
  select statement_timestamp(), 'PROJECT_OVERALLOCATED', 'critical', 'contracts', c.id, 1, 'Projetos ativos excedem o valor do contrato.'
  from public.contracts c
  left join public.projects p on p.contract_id = c.id and p.owner_id = c.owner_id and p.status <> 'cancelled'
  where c.status = 'active' group by c.owner_id, c.id, c.total_value
  having coalesce(sum(p.contracted_value), 0) > c.total_value
  union all
  select statement_timestamp(), 'REFUND_EXCEEDS_RECEIPT', 'critical', 'financial_payments', receipt.id, 1, 'Estornos excedem o recebimento original.'
  from public.financial_payments receipt
  join public.financial_payments refund on refund.related_payment_id = receipt.id
    and refund.owner_id = receipt.owner_id and refund.type = 'refund'
  where receipt.type = 'receipt' group by receipt.owner_id, receipt.id, receipt.amount
  having sum(refund.amount) > receipt.amount
  union all
  select statement_timestamp(), 'INVALID_REFUND_RELATION', 'critical', 'financial_payments', p.id, 1, 'Estorno nao referencia um recebimento valido.'
  from public.financial_payments p
  left join public.financial_payments related on related.id = p.related_payment_id
    and related.owner_id = p.owner_id and related.contract_id = p.contract_id
  where (p.type = 'receipt' and p.related_payment_id is not null)
     or (p.type = 'refund' and (related.id is null or related.type <> 'receipt'));
end;
$$;
revoke all on function public.diagnose_data_integrity() from public, anon;
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
perform public.write_audit_event(
  v_owner, v_owner, 'backup.table_restored', v_def.table_name,
  v_def.table_name, jsonb_build_object('count', v_count)
);
-- ...after set_config('ber.restore', 'off', true):
v_audit_id := public.write_audit_event(
  v_owner, v_owner, 'backup.restore', 'backup', v_hash,
  jsonb_build_object('count', (v_classification -> 'totals' ->> 'new')::int)
);
return jsonb_build_object('inserted', v_inserted, 'audit_event_id', v_audit_id);
```

`v_hash` is the validated 64-character SHA-256 package hash. `ber.restore = 'on'` must surround only the trusted insert loop, and the generic trigger must not duplicate those explicit events. The RPC may return `audit_event_id`; `src/services/backupService.ts` and `src/types/backup.ts` must accept it without weakening validation. The writer raises on failure, so restore and audit commit or roll back together. If any detail differs, stop and have WP4's owner correct WP4/`0012`; this task creates only `0013` and never edits `0012`.

- [ ] **Step 6: Commit the migration only after SQL review.**

```bash
git add supabase/migrations/0013_etapa3_security_audit.sql
git commit -m "feat: adicionar seguranca auditoria e integridade"
```

Do not apply this migration remotely as part of this commit. Database execution is Task 6 and remains externally dependent without authorization.

---

## Task 4: Prove append-only auditing, rollback, grants and owner isolation in SQL

**Files:**

- Create: `supabase/tests/etapa3_security.sql`.
- Do not edit `0010`–`0012`, the WP4 audit test or the two-owner manual checklist owned by Task 6.

**Interfaces:**

- Input: a disposable/local PostgreSQL database with `0001`–`0013` applied and permission to create synthetic auth users.
- Output: transactional assertions for role protection, direct-write denial, typed audit metadata, rollback, cursor stability, diagnostics and two-owner SELECT isolation.
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
     or strpos(v_restore_definition, 'backup.table_restored') = 0
     or strpos(v_restore_definition, 'ber.restore') = 0
     or strpos(v_restore_definition, 'audit_event_id') = 0 then
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
  select pg_catalog.pg_get_triggerdef(oid) into v_status from pg_catalog.pg_trigger
  where tgrelid = 'public.audit_events'::regclass and tgname = 'audit_events_reject_row_mutation';
  if strpos(upper(v_status), 'FOR EACH ROW') = 0 or strpos(upper(v_status), 'UPDATE OR DELETE') = 0 then
    raise exception 'trigger de auditoria UPDATE/DELETE nao e de linha.';
  end if;
  select pg_catalog.pg_get_triggerdef(oid) into v_status from pg_catalog.pg_trigger
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
    jsonb_build_object('backup_id', repeat('b', 64), 'count', 1)
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
  select count(*) into v_count from public.diagnose_data_integrity();
  if v_count <> 0 then raise exception 'diagnostico encontrou problema nos dados validos de teste.'; end if;

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

-- Synthetic corruption fixtures for every diagnostic category. Constraint/index
-- changes and all rows are inside this transaction and disappear at rollback.
do $$
declare
  v_owner_a uuid;
  v_owner_b uuid;
  v_lead_a1 uuid;
  v_lead_a2 uuid;
  v_lead_b uuid;
  v_client_a uuid;
  v_client_b uuid;
  v_contract_a uuid;
  v_contract_b uuid;
  v_project_a uuid;
  v_project_b uuid;
  v_task_a uuid;
  v_revision_a uuid;
  v_category_a uuid;
  v_installment_a1 uuid;
  v_installment_a2 uuid;
  v_installment_b uuid;
  v_payment_a1 uuid;
  v_payment_a2 uuid;
  v_payment_a3 uuid;
  v_refund_a uuid;
  v_required_code text;
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

  insert into public.clients (owner_id, creation_key, name, status) values
    (v_owner_a, gen_random_uuid(), 'Cliente A', 'active'),
    (v_owner_b, gen_random_uuid(), 'Cliente B', 'active');
  select id into v_client_a from public.clients where owner_id = v_owner_a;
  select id into v_client_b from public.clients where owner_id = v_owner_b;
  insert into public.contracts (owner_id, client_id, service, total_value, contracted_at) values
    (v_owner_a, v_client_a, 'Site', 100, current_date),
    (v_owner_b, v_client_b, 'Site', 200, current_date);
  select id into v_contract_a from public.contracts where owner_id = v_owner_a;
  select id into v_contract_b from public.contracts where owner_id = v_owner_b;
  insert into public.projects (owner_id, client_id, contract_id, name, service, contracted_value) values
    (v_owner_a, v_client_a, v_contract_a, 'Projeto A', 'Site', 100),
    (v_owner_b, v_client_b, v_contract_b, 'Projeto B', 'Site', 200);
  select id into v_project_a from public.projects where owner_id = v_owner_a;
  select id into v_project_b from public.projects where owner_id = v_owner_b;
  insert into public.project_tasks (owner_id, project_id, title, position) values
    (v_owner_a, v_project_a, 'Tarefa A1', 0), (v_owner_a, v_project_a, 'Tarefa A2', 0);
  select id into v_task_a from public.project_tasks where title = 'Tarefa A1';
  insert into public.project_revisions (owner_id, project_id, description) values
    (v_owner_a, v_project_a, 'Revisao A') returning id into v_revision_a;

  insert into public.contract_installments (owner_id, contract_id, position, amount, due_date) values
    (v_owner_a, v_contract_a, 0, 60, current_date + 10),
    (v_owner_a, v_contract_a, 1, 40, current_date + 20),
    (v_owner_b, v_contract_b, 0, 200, current_date + 10);
  select id into v_installment_a1 from public.contract_installments where owner_id = v_owner_a and position = 0;
  select id into v_installment_a2 from public.contract_installments where owner_id = v_owner_a and position = 1;
  select id into v_installment_b from public.contract_installments where owner_id = v_owner_b;
  insert into public.financial_payments (owner_id, contract_id, idempotency_key, type, amount, received_at) values
    (v_owner_a, v_contract_a, gen_random_uuid(), 'receipt', 80, now()),
    (v_owner_a, v_contract_a, gen_random_uuid(), 'receipt', 70, now()),
    (v_owner_a, v_contract_a, gen_random_uuid(), 'receipt', 40, now());
  select id into v_payment_a1 from public.financial_payments where owner_id = v_owner_a and amount = 80;
  select id into v_payment_a2 from public.financial_payments where owner_id = v_owner_a and amount = 70;
  select id into v_payment_a3 from public.financial_payments where owner_id = v_owner_a and amount = 40;
  insert into public.financial_payments (owner_id, contract_id, idempotency_key, related_payment_id, type, amount, received_at)
  values (v_owner_a, v_contract_a, gen_random_uuid(), v_payment_a3, 'refund', 50, now()) returning id into v_refund_a;
  insert into public.financial_payment_allocations (owner_id, contract_id, payment_id, installment_id, amount) values
    (v_owner_a, v_contract_a, v_payment_a1, v_installment_a1, 50),
    (v_owner_a, v_contract_a, v_payment_a2, v_installment_a1, 70),
    (v_owner_a, v_contract_a, v_payment_a3, v_installment_a2, 40),
    (v_owner_a, v_contract_a, v_refund_a, v_installment_a2, 50);

  alter table public.leads drop constraint if exists leads_money_nonnegative;
  alter table public.leads drop constraint if exists leads_status_check;
  alter table public.projects drop constraint if exists projects_dates_check;
  alter table public.project_tasks drop constraint if exists project_tasks_status_check;
  alter table public.project_tasks drop constraint if exists project_tasks_dates_check;
  alter table public.project_revisions drop constraint if exists project_revisions_status_check;
  alter table public.lead_followups drop constraint if exists lead_followups_state_check;
  alter table public.lead_digital_checks drop constraint if exists lead_digital_checks_verified_check;
  alter table public.financial_payments drop constraint if exists financial_payments_type_check;
  alter table public.financial_payments drop constraint if exists financial_payments_type_relation_check;
  alter table public.financial_payments drop constraint if exists financial_payments_created_by_check;
  alter table public.financial_expenses drop constraint if exists financial_expenses_paid_check;
  alter table public.financial_expenses drop constraint if exists financial_expenses_cancelled_check;
  alter table public.client_activities drop constraint if exists client_activities_created_by_check;
  alter table public.user_settings drop constraint if exists user_settings_prices_check;
  alter table public.user_settings drop constraint if exists user_settings_service_prices_check;
  drop index if exists public.expense_categories_owner_name_key;

  set local session_replication_role = replica;
  update public.leads set estimated_value = -1, status = 'invalid' where id = v_lead_a1;
  update public.projects set contracted_value = 120, start_date = current_date + 2, due_date = current_date + 1 where id = v_project_a;
  update public.project_tasks set status = 'invalid', start_date = current_date + 2, due_date = current_date + 1,
    completed_at = now() where id = v_task_a;
  update public.project_revisions set status = 'invalid', completed_at = now() where id = v_revision_a;
  update public.financial_payments set type = 'invalid' where id = v_payment_a1;
  update public.financial_payments set created_by = v_owner_b where id = v_payment_a3;
  insert into public.financial_payments (owner_id, contract_id, idempotency_key, related_payment_id, type, amount, received_at)
  values (v_owner_a, v_contract_a, gen_random_uuid(), gen_random_uuid(), 'refund', 1, now());
  insert into public.lead_followups (owner_id, lead_id, due_at, status, completed_at)
  values (v_owner_a, v_lead_a1, now(), 'pendente', now());
  insert into public.lead_digital_checks (owner_id, lead_id, verified) values (v_owner_a, v_lead_a1, true);
  insert into public.financial_expenses (owner_id, description, amount, expense_date, status)
  values (v_owner_a, 'Despesa invalida', 10, current_date, 'paid');
  insert into public.expense_categories (owner_id, name) values
    (v_owner_a, 'Categoria duplicada'), (v_owner_a, 'Categoria duplicada');
  insert into public.user_settings (owner_id, service_prices) values (v_owner_a, '{"site":-1}');
  insert into public.lead_activities (owner_id, lead_id, type, description, user_id)
  values (v_owner_a, v_lead_b, 'observacao', 'Owner incompativel', v_owner_a);
  insert into public.lead_activities (owner_id, lead_id, type, description, user_id)
  values (v_owner_a, gen_random_uuid(), 'observacao', 'Orfa', v_owner_a);
  insert into public.project_tasks (owner_id, project_id, title) values (v_owner_a, v_project_b, 'Tarefa cross-owner');
  insert into public.client_activities (owner_id, client_id, project_id, type, description, created_by)
  values (v_owner_a, v_client_a, v_project_b, 'note', 'Atividade cross-owner', v_owner_b);
  insert into public.financial_payment_allocations (owner_id, contract_id, payment_id, installment_id, amount)
  values (v_owner_a, v_contract_a, v_payment_a1, v_installment_b, 1);
  insert into public.financial_expenses (owner_id, description, amount, expense_date, project_id, contract_id)
  values (v_owner_a, 'Despesa cross-owner', 1, current_date, v_project_b, v_contract_a);
  set local session_replication_role = origin;

  perform set_config('request.jwt.claim.sub', v_owner_a::text, true);
  set local role authenticated;
  select count(*) into v_count from public.diagnose_data_integrity();
  if v_count = 0 then raise exception 'diagnostico nao encontrou nenhuma corrupcao sintetica.'; end if;
  foreach v_required_code in array array[
    'LEGACY_ORPHAN', 'OWNER_INCOMPATIBLE', 'DUPLICATE_PHONE', 'DUPLICATE_CATEGORY',
    'DUPLICATE_TASK_POSITION', 'INVALID_MONEY', 'INVALID_DATE', 'INVALID_STATUS',
    'INVALID_FOLLOWUP_STATE', 'INVALID_TASK_STATE', 'INVALID_REVISION_STATE',
    'INVALID_DIGITAL_CHECK', 'INVALID_EXPENSE_STATE', 'INVALID_SETTINGS',
    'PAYMENT_ALLOCATION_DIVERGENCE', 'INSTALLMENT_OVERALLOCATED',
    'PROJECT_OVERALLOCATED', 'CONTRACT_OVERPAID', 'REFUND_EXCEEDS_RECEIPT',
    'INVALID_REFUND_RELATION'
  ] loop
    if not exists (select 1 from public.diagnose_data_integrity() where code = v_required_code) then
      raise exception 'diagnostico nao cobriu a categoria %.', v_required_code;
    end if;
  end loop;
  if exists (
    select 1 from public.diagnose_data_integrity()
    where entity_id in (v_lead_b, v_client_b, v_contract_b, v_project_b, v_installment_b)
  ) then raise exception 'diagnostico vazou IDs do proprietario B.'; end if;
  reset role;
end;
$$;

rollback;
```

- [ ] **Step 2: Statically review the test before any database run.**

```bash
git diff --check
git grep -n '00000000-0000-0000-0000-0000000000b01' -- supabase/tests/etapa3_security.sql && exit 1 || true
git grep -n '^rollback;' -- supabase/tests/etapa3_security.sql
```

Expected: no nonexistent fixture UUID, exactly one terminal `rollback;`, generated synthetic users/IDs, dynamic São Paulo date arithmetic, the exact 16-key metadata fixture, textual backup entity ID, separate row/statement trigger definitions, three cursor pages plus exact/limit+1/tie/invalid-cursor cases, restore timestamp and duplicate-audit guards, owner-level UPDATE/DELETE/TRUNCATE probes preserving the original row, forced audit rollback, and synthetic corruption fixtures for every diagnostic category. Constraint/index changes exist only inside the rolled-back diagnostic transaction. This is a static check only.

- [ ] **Step 3: Run locally only when a disposable database is available.**

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/etapa3_security.sql
```

Expected: every assertion passes and the final `rollback;` leaves no test data. This synthetic transaction does not prove real Supabase Auth/RLS runtime behavior; Task 6 requires two actual authenticated owners for that classification. Never put `TEST_DATABASE_URL` in CI or a public workflow.

- [ ] **Step 4: Commit the test.**

```bash
git add supabase/tests/etapa3_security.sql
git commit -m "test: provar auditoria append-only e isolamento sintetico"
```

---

## Task 5: Expose read-only integrity diagnostics in the Backup integration

**Files:**

- Create: `src/services/integrityService.ts`
- Create: `src/services/integrityService.test.ts`
- Create: `src/components/backup/IntegrityDiagnostics.tsx`
- Create: `src/components/backup/IntegrityDiagnostics.test.tsx`
- Modify: `src/pages/BackupPage.tsx` — owned by WP4; add only the integration import and component.

**Interfaces:**

```ts
type IntegritySeverity = 'critical' | 'important' | 'warning'
interface IntegrityIssue {
  generated_at: string
  code: string
  severity: IntegritySeverity
  entity_type: string
  entity_id: string | null
  affected_count: number
  message: string
}
diagnoseDataIntegrity(): Promise<IntegrityIssue[]>
```

- [ ] **Step 1: Write the failing service test.**

Create `src/services/integrityService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/db', () => ({
  requireSupabase: () => ({ rpc }),
  throwDbError: (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  },
}))

import { diagnoseDataIntegrity } from './integrityService'

describe('diagnoseDataIntegrity', () => {
  beforeEach(() => rpc.mockReset())

  it('reads the named RPC and returns only diagnostic rows', async () => {
    const issue = {
      generated_at: '2026-11-26T12:00:00Z', code: 'INVALID_MONEY', severity: 'critical',
      entity_type: 'leads', entity_id: 'lead-A', affected_count: 1, message: 'Valor inválido.',
    }
    rpc.mockResolvedValue({ data: [issue], error: null })

    await expect(diagnoseDataIntegrity()).resolves.toEqual([issue])
    expect(rpc).toHaveBeenCalledWith('diagnose_data_integrity')
  })

  it('rejects malformed data instead of showing a false clean diagnosis', async () => {
    rpc.mockResolvedValue({ data: { issues: [] }, error: null })
    await expect(diagnoseDataIntegrity()).rejects.toThrow('Resposta inválida do diagnóstico.')
  })

  it('propagates database failure through the shared error boundary', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for table internal' } })
    await expect(diagnoseDataIntegrity()).rejects.toThrow()
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/services/integrityService.test.ts
```

Expected RED: service does not exist.

- [ ] **Step 2: Implement the read-only service.**

Create `src/services/integrityService.ts`:

```ts
import { requireSupabase, throwDbError } from '../lib/db'

export type IntegritySeverity = 'critical' | 'important' | 'warning'

export interface IntegrityIssue {
  generated_at: string
  code: string
  severity: IntegritySeverity
  entity_type: string
  entity_id: string | null
  affected_count: number
  message: string
}

function isIssue(value: unknown): value is IntegrityIssue {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.generated_at === 'string'
    && typeof row.code === 'string'
    && (row.severity === 'critical' || row.severity === 'important' || row.severity === 'warning')
    && typeof row.entity_type === 'string'
    && (row.entity_id === null || typeof row.entity_id === 'string')
    && typeof row.affected_count === 'number'
    && typeof row.message === 'string'
}

export async function diagnoseDataIntegrity(): Promise<IntegrityIssue[]> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('diagnose_data_integrity')
  throwDbError(error)
  if (!Array.isArray(data) || !data.every(isIssue)) {
    throw new Error('Resposta inválida do diagnóstico.')
  }
  return data
}
```

Run the focused test. Expected GREEN.

- [ ] **Step 3: Write the failing diagnostics component test.**

Create `src/components/backup/IntegrityDiagnostics.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IntegrityDiagnostics } from './IntegrityDiagnostics'
import { diagnoseDataIntegrity } from '../../services/integrityService'

vi.mock('../../services/integrityService', () => ({ diagnoseDataIntegrity: vi.fn() }))

const issue = {
  generated_at: '2026-11-26T12:00:00Z', code: 'INVALID_MONEY', severity: 'critical' as const,
  entity_type: 'leads', entity_id: null, affected_count: 2, message: 'Dois leads com valor inválido.',
}

describe('IntegrityDiagnostics', () => {
  beforeEach(() => vi.mocked(diagnoseDataIntegrity).mockReset())
  afterEach(cleanup)

  it('loads on demand and lists real issue codes', async () => {
    vi.mocked(diagnoseDataIntegrity).mockResolvedValue([issue])
    render(<IntegrityDiagnostics />)

    expect(diagnoseDataIntegrity).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Executar diagnóstico' }))

    expect(await screen.findByText('INVALID_MONEY')).toBeTruthy()
    expect(screen.getByText('Dois leads com valor inválido.')).toBeTruthy()
    expect(screen.getByText(/Somente leitura/)).toBeTruthy()
  })

  it('distinguishes a clean result from an error', async () => {
    vi.mocked(diagnoseDataIntegrity).mockResolvedValue([])
    render(<IntegrityDiagnostics />)
    fireEvent.click(screen.getByRole('button', { name: 'Executar diagnóstico' }))
    expect(await screen.findByText('Nenhum problema encontrado nos dados acessíveis.')).toBeTruthy()

    vi.mocked(diagnoseDataIntegrity).mockRejectedValue(new Error('secret backend'))
    fireEvent.click(screen.getByRole('button', { name: 'Executar diagnóstico' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/secret backend/)).toBeNull()
  })
})
```

Run:

```bash
npm test -- --maxWorkers=2 src/components/backup/IntegrityDiagnostics.test.tsx
```

Expected RED: component does not exist.

- [ ] **Step 4: Implement the read-only component.**

Create `src/components/backup/IntegrityDiagnostics.tsx`:

```tsx
import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { diagnoseDataIntegrity, type IntegrityIssue } from '../../services/integrityService'
import { toPublicErrorMessage } from '../../lib/publicError'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

export function IntegrityDiagnostics() {
  const [issues, setIssues] = useState<IntegrityIssue[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      setIssues(await diagnoseDataIntegrity())
    } catch (cause) {
      setIssues(null)
      setError(toPublicErrorMessage(cause, 'Não foi possível executar o diagnóstico.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Diagnóstico de integridade" dot="accent">
      <p className="text-sm text-muted">
        Somente leitura. Verifica órfãos, duplicidades, valores, datas, status, saldos, alocações e donos incompatíveis.
        Nenhuma correção ou exclusão é executada.
      </p>
      <Button type="button" variant="outline" className="mt-3" loading={loading} onClick={() => void run()}>
        <ShieldCheck className="h-4 w-4" /> Executar diagnóstico
      </Button>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      {issues !== null && issues.length === 0 && (
        <p role="status" className="mt-3 text-sm text-primary">Nenhum problema encontrado nos dados acessíveis.</p>
      )}
      {issues !== null && issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label="Problemas de integridade">
          {issues.map((issue, index) => (
            <li key={`${issue.code}:${issue.entity_type}:${issue.entity_id}:${index}`} className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
              <p className="font-medium text-ink">{issue.code} · {issue.entity_type} · {issue.affected_count} registro(s)</p>
              <p className="mt-1 text-muted">{issue.message}</p>
              {issue.entity_id && <p className="mt-1 break-all text-xs text-muted">ID: {issue.entity_id}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
```

- [ ] **Step 5: Integrate into the WP4 Backup page.**

In `src/pages/BackupPage.tsx`, add:

```ts
import { IntegrityDiagnostics } from '../components/backup/IntegrityDiagnostics'
```

Render one instance above the destructive restore section:

```tsx
<IntegrityDiagnostics />
```

Do not add repair buttons, DELETE calls or automatic fixes. If a destructive correction is later required, it needs a backup, explicit confirmation and a separate reviewed procedure.

- [ ] **Step 6: Verify and commit.**

```bash
npm test -- --maxWorkers=2 src/services/integrityService.test.ts src/components/backup/IntegrityDiagnostics.test.tsx src/pages/BackupPage.test.tsx
npm run build
npm run lint
git add src/services/integrityService.ts src/services/integrityService.test.ts src/components/backup/IntegrityDiagnostics.tsx src/components/backup/IntegrityDiagnostics.test.tsx src/pages/BackupPage.tsx
git commit -m "feat: expor diagnostico read-only de integridade"
```

---

## Task 6: Prepare real two-owner runtime evidence and classify external validation

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

## Task 7: Move dashboard aggregation to the server and add bounded cursor/lazy loading

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
    await expect(listFollowupsPage('today', { at: '2026-11-26T14:00:00Z', id: followup.id }, 25)).resolves.toEqual({
      items: [followup], nextCursor: { at: followup.due_at, id: followup.id }, hasMore: true,
    })
    expect(rpc).toHaveBeenCalledWith('list_followups_cursor', {
      p_list: 'today', p_after_at: '2026-11-26T14:00:00Z', p_after_id: followup.id, p_limit: 25,
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
npm test -- --maxWorkers=2 src/services/dashboardService.test.ts src/pages/DashboardPage.test.tsx src/services/cursorPagination.test.ts src/services/followupService.test.ts src/services/activityService.test.ts src/pages/FollowUpsPage.test.tsx src/routes/AppRoutes.test.tsx
npm run build
npm run lint
git add src/services/dashboardService.ts src/services/dashboardService.test.ts src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/components/dashboard/DashboardCharts.tsx src/services/followupService.ts src/services/followupService.test.ts src/services/cursorPagination.test.ts src/pages/FollowUpsPage.tsx src/services/activityService.ts src/services/activityService.test.ts src/pages/LeadDetailPage.tsx src/pages/PipelinePage.tsx src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx
git commit -m "perf: agregar dashboard no servidor e cursorizar listas"
```

Inspect the production bundle after build and record actual chunk names/sizes. Expected static result: no `recharts` import in the initial Dashboard route and separate chunks for Reports, Backup and chart code. Do not claim a speed improvement without before/after measurements.

---

## Task 8: Add integrated mocked journey and real-browser responsive smoke tests

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

Create `src/pages/IntegratedJourney.test.tsx` with real `AppRoutes`, `ProtectedRoute`, `AppLayout`, `LoginPage`, `DashboardPage`, `SettingsPage`, `ReportsPage`, `BackupPage` and the actual Clientes/Projetos/Financeiro pages. Mock service modules, not page components. Use the completed page selectors from WP0–WP4 and cover this sequence:

1. Unauthenticated `/clientes` redirects to `/login`.
2. Sign in with mocked Auth; the dashboard shows loading, then empty state.
3. Navigate to Clientes, create a client, see its detail and return to the list.
4. Navigate to Projetos, create a project linked to that client, advance one task and see the activity.
5. Navigate to Financeiro, register a receipt and an expense, and assert the displayed received/paid/profit values use integer cents.
6. Navigate to Relatórios, change a period/filter, and assert indicators, table and export request receive the same normalized range.
7. Open Configurações, save profile/settings and assert no `role` key is sent.
8. Open Backup, run diagnostics and assert empty/error states; do not invoke a real restore.
9. Force one service rejection and assert a public error plus retry, never raw backend text.
10. Unmount and assert in-flight responses cannot overwrite the current route.

Use `vi.hoisted` for service spies, `cleanup` in `afterEach`, native DOM assertions and `findBy*` for lazy routes. The test must fail if any module route still renders an empty module placeholder. Add a second test that renders the same journey at a 390px jsdom viewport and asserts the mobile menu button, dialog focus, accessible names and absence of nested interactive controls; jsdom does not prove visual layout, so Task 8 Step 4 supplies real-browser evidence.

Run:

```bash
npm test -- --maxWorkers=2 src/pages/IntegratedJourney.test.tsx
```

Expected RED until all WP0–WP4 routes/services are integrated. Fix integration defects in their owning files; do not replace real pages with test-only stubs in production.

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
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwZDAxIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock-signature'
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
  await page.route('**/auth/v1/health', (route) => route.fulfill({ json: { ok: true } }))
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
  await page.route('**/rest/v1/rpc/get_dashboard_snapshot', (route) => route.fulfill({ json: emptySnapshot }))
  await page.route('**/rest/v1/rpc/diagnose_data_integrity', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    json: [],
    headers: { 'content-range': '0-0/0', 'content-type': 'application/json' },
  }))
}

test('private route redirects and recovery uses a non-enumerating message', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/clientes')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail').fill('owner@example.test')
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado')
})

test('authenticated module journey stays usable without horizontal overflow', async ({ page }) => {
  await seedSession(page)
  await mockSupabase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Seu CRM está pronto para começar')).toBeVisible()

  for (const path of ['/clientes', '/projetos', '/financeiro', '/relatorios', '/configuracoes', '/backup']) {
    await page.goto(path)
    await expect(page.getByRole('main')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, `overflow horizontal em ${path}`).toBe(false)
  }

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
  await mockSupabase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('ber-crm:client-draft:v1:owner-A:scope', 'PII'))
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  const draft = await page.evaluate(() => sessionStorage.getItem('ber-crm:client-draft:v1:owner-A:scope'))
  expect(draft).toBeNull()
})
```

- [ ] **Step 4: Install the browser and run the smoke locally.**

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: mobile and desktop projects pass; no real network call reaches Supabase; no horizontal overflow; mobile drawer traps/returns focus; logout removes drafts. A jsdom pass alone is not browser evidence.

- [ ] **Step 5: Verify and commit.**

```bash
npm test -- --maxWorkers=2 src/pages/IntegratedJourney.test.tsx
npm run test:e2e
npm run build
npm run lint
git add src/pages/IntegratedJourney.test.tsx playwright.config.ts e2e/journey.spec.ts package.json package-lock.json
git commit -m "test: cobrir jornada integrada e responsividade"
```

---

## Task 9: Add Node 24 CI and Vercel security headers

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

## Task 10: Replace outdated README and create database/deployment documentation

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

Aplique `supabase/migrations/0001_profiles.sql` até `0013_etapa3_security_audit.sql`, em ordem, pelo processo autorizado. Não edite migrations antigas. `0010`–`0012` são dependências de Relatórios, Configurações e Backup; `0013` é segurança, auditoria, diagnóstico e performance.

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

- `diagnose_data_integrity()` é read-only e dono-escopada; detecta órfãos, duplicidades, valores/datas/status inválidos, saldos/alocações divergentes e donos incompatíveis.
- `get_dashboard_snapshot()` agrega no servidor.
- `list_followups_cursor()` e `list_lead_activities_cursor()` usam ordenação estável `(data,id)`.
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

## Task 11: Run the fresh final gate, self-review and classified report

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
git grep -nE 'TBD|TODO|TO-DO|implemente depois|semelhante a|00000000-0000-0000-0000-0000000000b01|00000000-0000-0000-0000-0000000000c0' -- docs/superpowers/plans/2026-11-26-etapa3-seguranca-finalizacao.md supabase/tests/etapa3_security.sql supabase/tests/etapa3_two_owners_manual.sql
```

Expected: no matches. In the manual probe, real user UUIDs must be supplied at execution; the static file must use named placeholders in the SQL comment only, not pretend they are real evidence.

- [ ] **Step 4: Reconcile TypeScript and SQL signatures.**

Compare every frontend `.rpc('name', args)` with `pg_proc` and the migration definition:

```text
get_dashboard_snapshot(timestamptz) -> jsonb
diagnose_data_integrity() -> setof record/table
list_followups_cursor(text,timestamptz,uuid,integer) -> jsonb
list_lead_activities_cursor(uuid,timestamptz,uuid,integer) -> jsonb
write_audit_event(uuid,uuid,text,text,uuid,jsonb) -> void, trigger-only
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

Este plano finaliza a Etapa 3 existente sem recriar o projeto. Ele endurece Auth, recuperação, expiração, erros, URLs, RLS, grants, `profiles.role`, `search_path`, checks e FKs compostas por dono. A migration aditiva `0013` cria auditoria append-only com metadados mínimos e rollback transacional, diagnóstico read-only, agregação server-side, índices e cursor estável. O frontend passa a usar snapshot do dashboard, listas limitadas e chunks lazy para gráficos, Relatórios e Backup. Testes cobrem dois donos sintéticos, jornada integrada, responsividade mobile/desktop e smoke browser mockado. CI Node 24, headers Vercel, README, schema e deploy são atualizados. A execução depende de Planos 1–3 e dos planos paralelos `0010`–`0012`, sem editá-los. Migrations remotas, RLS real entre usuários, persistência autenticada e publicação permanecem dependentes de configuração externa até haver evidência. Nenhum Critical/Important aberto permite declarar finalização.
