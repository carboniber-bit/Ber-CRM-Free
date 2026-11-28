# Projetos e Produção — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar projetos com cards, lista e Kanban, tarefas, progresso derivado, revisões, aprovação e entrega, integrados ao cliente e ao histórico sem alterar receita.

**Architecture:** A migration `0008` acrescenta tarefas e revisões com RLS, triggers de timestamps/histórico e RPCs para projetos, cuja escrita direta continua bloqueada pela fundação. O frontend calcula progresso somente a partir de tarefas ativas e reutiliza o padrão de fila por ID do Pipeline de leads.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7, Supabase Free/PostgreSQL, `@dnd-kit`, Vitest 5, Testing Library, Lucide.

**Spec:** `docs/superpowers/specs/2026-11-25-etapa3-design.md`

**Depends on:** `docs/superpowers/plans/2026-11-25-etapa3-plano1-clientes.md` completed, including `src/types/project.ts`, `src/types/contract.ts`, `src/lib/money.ts`, `clientService` and migrations `0006`–`0007`.

## Global Constraints

- “ATENÇÃO: NÃO RECRIE O PROJETO.”
- Stack mantida: React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router 7, Supabase Free, Recharts, `@dnd-kit`, Lucide.
- Interface em pt-BR, dark mode grafite, verde principal, Montserrat/Roboto e acentos azul/lime/rosa.
- Somente ferramentas gratuitas e free tiers; nenhuma cobrança, trial, upgrade, API paga ou automação de mensagens.
- Credenciais reais somente em `.env.local`; `.env.example` permanece sem credenciais. Nunca usar `service_role` no frontend.
- Nenhuma tabela privada sem RLS; cada usuário acessa somente os próprios registros.
- Nenhum número fictício apresentado como dado real.
- Valores estimados, negociados, contratados, recebidos e pendentes permanecem semanticamente separados.
- Progresso é derivado de tarefas; canceladas e excluídas não entram no denominador; sem tarefas ativas o resultado é `null`.
- Concluir, aprovar ou entregar projeto não cria receita nem altera contrato/pagamento.
- A soma dos valores alocados a projetos não cancelados nunca pode exceder o contrato.
- Toda RPC que altera contrato ou alocação adquire a advisory `:contract:<id>` antes de `FOR UPDATE`; `deliver_project` não disputa contrato e trava somente o projeto. Mutações diretas de tarefas e `reorder_project_tasks` usam a advisory por proprietário `owner_id::text || ':project_tasks'` antes de qualquer linha; a reordenação também bloqueia projeto e tarefas por `id` antes dos updates.
- Registros com dependências são cancelados/arquivados, não excluídos definitivamente; tarefas podem ser excluídas com confirmação.
- TDD RED/GREEN em cada comportamento novo; commits pequenos e frequentes.
- Não afirmar que migration, RLS entre dois usuários ou validação autenticada foi executada sem evidência real.
- Relatórios, Configurações, Backup e Segurança pertencem à mesma Etapa 3; nenhuma etapa nova começa sem autorização explícita.

## Rulings da auditoria de 2026-11-26

- Ações de criação ficam somente nos cabeçalhos de tarefas e revisões; `EmptyState` é informativo para evitar comandos duplicados com o mesmo nome acessível.
- A fixture de edição representa cliente e contrato atuais disponíveis; o teste aguarda o formulário antes de interagir, enquanto o bloqueio por contrato indisponível continua sendo testado separadamente.
- Clientes elegíveis são todos exceto `inactive`; contratos elegíveis continuam sendo somente `active`.
- Campos de entrega/arquivos preservam o texto digitado com `type="text"` e `inputMode="url"`; a validação HTTP(S) explícita rejeita whitespace antes da RPC.
- O merge otimista do Kanban preserva `client_name` porque a RPC não retorna essa relação derivada.
- Cards, lista e Kanban recebem os mesmos filtros; o board mantém o limite de 500 e sinaliza resultados parciais.
- Revisão aprovada é imutável no banco, inclusive identidade, datas de solicitação/criação, descrição, responsável, notas, projeto e proprietário, além do status.
- A sequência documentada de migrations inclui `0007_lead_maps_url.sql` entre a fundação de clientes e a migration de projetos.

## Convenções de teste

- Todo arquivo `.test.tsx` começa com `// @vitest-environment jsdom`; o ambiente global é `node` e não há matchers jest-dom instalados.
- Todo teste de componente importa `cleanup` de `@testing-library/react` e executa `afterEach(cleanup)`.
- Asserções DOM usam propriedades nativas (`textContent`, `getAttribute`, `hasAttribute`, `value`, `disabled` e `null`), nunca `toBeInTheDocument`, `toBeDisabled`, `toHaveAttribute` ou `toHaveValue`.
- Mocks que capturam variáveis externas usam `vi.hoisted`; mocks parciais preservam o módulo real com `importOriginal`.
- Testes de página mockam os serviços filhos explicitamente, inclusive tarefas, revisões, formulário e entrega, para nunca abrir conexão com o banco.
- Fixtures tipadas usam os campos reais do domínio; cliente arquivado tem `status: 'inactive'` e `archived_at` preenchido.
- Componentes que usam `useToast` são envolvidos em `ToastContext.Provider` ou têm o hook explicitamente mockado.

## File Structure

| File | Responsabilidade |
| ---- | ---------------- |
| `src/types/project.ts` | Projeto, tarefa, revisão, métricas e payloads. |
| `src/lib/projectProgress.ts` | Progresso e sugestão de prazo. |
| `supabase/migrations/0008_etapa3_projects.sql` | Tarefas, revisões, RLS, triggers e RPCs de projeto. |
| `supabase/tests/etapa3_projects.sql` | Alocação, histórico, rollback e isolamento. |
| `supabase/tests/etapa3_task_concurrency.sql` | Serialização de CRUD direto e reordenação com conexões independentes. |
| `src/services/projectService.ts` | Fronteira Supabase de projetos/tarefas/revisões. |
| `src/services/projectTaskService.ts` | CRUD de tarefas e ordenação. |
| `src/services/projectRevisionService.ts` | CRUD de revisões e aprovação. |
| `src/hooks/useProjectStatusQueue.ts` | Movimentações concorrentes e otimistas do Kanban. |
| `src/components/projects/ProjectForm.tsx` | Criação/edição vinculada a cliente e contrato. |
| `src/components/projects/ProjectStatusBadge.tsx` | Status de projeto sem quebrar badges de lead. |
| `src/components/projects/ProjectPriorityBadge.tsx` | Prioridade de projeto. |
| `src/components/projects/ProjectCard.tsx` | Card compartilhado por lista e Kanban. |
| `src/components/projects/ProjectKanbanColumn.tsx` | Coluna arrastável. |
| `src/components/projects/ProjectTaskList.tsx` | Tarefas e progresso. |
| `src/components/projects/ProjectRevisionList.tsx` | Revisões e aprovação. |
| `src/components/projects/ProjectDeliveryPanel.tsx` | Entrega explícita. |
| `src/pages/ProjectsPage.tsx` | Cards/lista/Kanban e filtros. |
| `src/pages/ProjectNewPage.tsx` | Criação manual. |
| `src/pages/ProjectDetailPage.tsx` | Visão, tarefas, revisões, entrega e histórico. |

---

### Task 1: Ampliar tipos e implementar progresso/sugestão de prazo

**Files:**
- Modify: `src/types/project.ts`
- Create: `src/lib/projectProgress.ts`
- Create: `src/lib/projectProgress.test.ts`

**Interfaces:**
- Consumes: `Project`, `ProjectStatus`, `ProjectPriority`, `ClientActivity` from Plan 1.
- Produces: `ProjectMoveStatus`, `PROJECT_MOVE_STATUSES`, `ProjectTask`, `ProjectRevision`, `ProjectMetrics`, `ProjectFilters`, `ProjectSort`, `ProjectListResult`, `ProjectBoardResult`, `ProjectFormOptions`, `ProjectFormClientOption`, `ProjectFormContractOption`, `ProjectListItem`, `ProjectDetail`, `ProjectWrite`, `ProjectTaskWrite`, `ProjectRevisionWrite`, `DeliveryInput`.
- Produces: `calculateProjectProgress(tasks)`, `suggestProjectDueDate(service, startDate)`.

- [ ] **Step 1: Write the failing pure-function tests**

```ts
// src/lib/projectProgress.test.ts
import { describe, expect, it } from 'vitest'
import type { ProjectTask } from '../types/project'
import { calculateProjectProgress, suggestProjectDueDate } from './projectProgress'

const task = (status: ProjectTask['status']): ProjectTask => ({
  id: status, owner_id: 'owner', project_id: 'project', title: status,
  description: null, status, responsible_name: null, start_date: null,
  due_date: null, priority: 'medium', position: 0, notes: null,
  completed_at: null, cancelled_at: null, created_at: '', updated_at: '',
})

describe('calculateProjectProgress', () => {
  it('ignora tarefas canceladas no denominador', () => {
    expect(calculateProjectProgress([task('completed'), task('pending'), task('cancelled')]))
      .toEqual({ progressPercent: 50, activeTasks: 2, completedTasks: 1 })
  })

  it('retorna null quando não há tarefas ativas', () => {
    expect(calculateProjectProgress([])).toEqual({ progressPercent: null, activeTasks: 0, completedTasks: 0 })
    expect(calculateProjectProgress([task('cancelled')])).toEqual({ progressPercent: null, activeTasks: 0, completedTasks: 0 })
  })

  it('retorna 100 quando todas as tarefas ativas foram concluídas', () => {
    expect(calculateProjectProgress([task('completed'), task('completed')]).progressPercent).toBe(100)
  })
})

describe('suggestProjectDueDate', () => {
  it('sugere 15 dias para site e 7 para social media', () => {
    expect(suggestProjectDueDate('Site institucional', '2026-11-25')).toBe('2026-12-10')
    expect(suggestProjectDueDate('Social media', '2026-11-25')).toBe('2026-12-02')
  })

  it('retorna null sem início e usa 15 dias para serviço desconhecido', () => {
    expect(suggestProjectDueDate('Consultoria', null)).toBeNull()
    expect(suggestProjectDueDate('Consultoria', '2026-11-25')).toBe('2026-12-10')
  })

  it('rejeita formato inválido e datas inexistentes no calendário real', () => {
    expect(suggestProjectDueDate('Site institucional', '2026-2-03')).toBeNull()
    expect(suggestProjectDueDate('Site institucional', '2026/11/25')).toBeNull()
    expect(suggestProjectDueDate('Site institucional', '2026-13-01')).toBeNull()
    expect(suggestProjectDueDate('Site institucional', '2026-02-30')).toBeNull()
  })

  it('soma dias em UTC na virada de mês e de ano e retorna YYYY-MM-DD', () => {
    expect(suggestProjectDueDate('Site institucional', '2026-11-20')).toBe('2026-12-05')
    expect(suggestProjectDueDate('Site institucional', '2026-12-20')).toBe('2027-01-04')
    expect(suggestProjectDueDate('Social media', '2026-12-28')).toBe('2027-01-04')

    const result = suggestProjectDueDate('Site institucional', '2026-12-20')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toHaveLength(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/projectProgress.test.ts`
Expected: FAIL because the module/types do not exist.

- [ ] **Step 3: Implement types and pure functions**

Append to `src/types/project.ts`:

```ts
export const PROJECT_MOVE_STATUSES = [
  'not_started', 'planning', 'in_development', 'awaiting_client_info',
  'in_review', 'awaiting_approval', 'changes_requested', 'completed', 'cancelled',
] as const
export type ProjectMoveStatus = typeof PROJECT_MOVE_STATUSES[number]

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const REVISION_STATUSES = ['requested', 'in_progress', 'completed', 'approved'] as const
export type RevisionStatus = typeof REVISION_STATUSES[number]

export interface ProjectTask {
  id: string
  owner_id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  responsible_name: string | null
  start_date: string | null
  due_date: string | null
  priority: ProjectPriority
  position: number
  notes: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectRevision {
  id: string
  owner_id: string
  project_id: string
  requested_at: string
  description: string
  responsible_name: string | null
  status: RevisionStatus
  completed_at: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMetrics {
  progressPercent: number | null
  activeTasks: number
  completedTasks: number
}

export interface ProjectFilters {
  search?: string
  clientId?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  dueFrom?: string
  dueTo?: string
}

export type ProjectSort = 'name_asc' | 'name_desc' | 'due_asc' | 'due_desc' | 'created_desc'

export interface ProjectListResult {
  projects: ProjectListItem[]
  total: number
}

export interface ProjectBoardResult {
  projects: ProjectListItem[]
  partial: boolean
}

export interface ProjectFormClientOption {
  id: string
  name: string
}

export interface ProjectFormContractOption {
  id: string
  client_id: string
  service: string
  total_value_cents: number
  allocated_cents: number
  remaining_cents: number
  due_date: string | null
}

export interface ProjectFormOptions {
  clients: ProjectFormClientOption[]
  contracts: ProjectFormContractOption[]
}

export interface ProjectListItem extends Project, ProjectMetrics {
  client_name: string | null
}

export interface ProjectDetail extends ProjectListItem {
  tasks: ProjectTask[]
  revisions: ProjectRevision[]
  activities: import('./client').ClientActivity[]
}

export interface ProjectWrite {
  clientId: string
  contractId: string
  name: string
  service: string
  contractedValueCents: number
  description: string
  startDate: string | null
  dueDate: string | null
  responsibleName: string
  priority: ProjectPriority
}

export interface ProjectTaskWrite {
  title: string
  description: string
  status: TaskStatus
  responsibleName: string
  startDate: string | null
  dueDate: string | null
  priority: ProjectPriority
  notes: string
}

export interface ProjectRevisionWrite {
  description: string
  responsibleName: string
  status: RevisionStatus
  notes: string
}

export interface DeliveryInput {
  deliveryUrl: string
  filesUrl: string
  finalNotes: string
  confirmed: boolean
}
```

```ts
// src/lib/projectProgress.ts
import type { ProjectMetrics, ProjectTask } from '../types/project'

export function calculateProjectProgress(tasks: ProjectTask[]): ProjectMetrics {
  const activeTasks = tasks.filter((task) => task.status !== 'cancelled')
  const completedTasks = activeTasks.filter((task) => task.status === 'completed').length
  return {
    progressPercent: activeTasks.length === 0 ? null : Math.round((completedTasks / activeTasks.length) * 100),
    activeTasks: activeTasks.length,
    completedTasks,
  }
}

export function suggestProjectDueDate(service: string, startDate: string | null): string | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null

  const [year, month, day] = startDate.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  const normalized = service.toLocaleLowerCase('pt-BR')
  const days = normalized.includes('social') ? 7 : normalized.includes('design') ? 10 : 15
  date.setUTCDate(date.getUTCDate() + days)

  if (date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999) return null
  return date.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/lib/projectProgress.test.ts && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types/project.ts src/lib/projectProgress.ts src/lib/projectProgress.test.ts
git commit -m "feat: adicionar dominio e progresso de projetos"
```

---

### Task 2: Criar tarefas e revisões na migration 0008

**Files:**
- Create: `supabase/migrations/0008_etapa3_projects.sql`

**Interfaces:**
- Consumes: `public.projects`, `public.client_activities`, `public.set_updated_at` from Plan 1.
- Produces: `project_tasks`, `project_revisions`, owner-scoped RLS and history triggers.

- [ ] **Step 1: Write the complete schema migration**

```sql
-- supabase/migrations/0008_etapa3_projects.sql
begin;

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  responsible_name text,
  start_date date,
  due_date date,
  priority text not null default 'medium' check (priority in ('very_high','high','medium','low')),
  position integer not null default 0,
  notes text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_tasks_owner_project_id_key unique (owner_id, project_id, id),
  constraint project_tasks_project_owner_fk foreign key (owner_id, project_id)
    references public.projects (owner_id, id) on delete cascade,
  constraint project_tasks_dates_check check (start_date is null or due_date is null or due_date >= start_date)
);

create index project_tasks_owner_project_idx on public.project_tasks (owner_id, project_id, position);
create index project_tasks_owner_status_idx on public.project_tasks (owner_id, status);
create index project_tasks_owner_due_idx on public.project_tasks (owner_id, due_date);

create table public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  requested_at timestamptz not null default now(),
  description text not null,
  responsible_name text,
  status text not null default 'requested' check (status in ('requested','in_progress','completed','approved')),
  completed_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_revisions_owner_project_id_key unique (owner_id, project_id, id),
  constraint project_revisions_project_owner_fk foreign key (owner_id, project_id)
    references public.projects (owner_id, id) on delete cascade
);

create index project_revisions_owner_project_idx on public.project_revisions (owner_id, project_id, requested_at desc);
create index project_revisions_owner_status_idx on public.project_revisions (owner_id, status);

alter table public.project_tasks enable row level security;
alter table public.project_revisions enable row level security;

revoke all on public.project_tasks from public, anon, authenticated;
revoke all on public.project_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.project_tasks to authenticated;
grant select, insert, update on public.project_revisions to authenticated;

create policy project_tasks_select_own on public.project_tasks for select using (auth.uid() = owner_id);
create policy project_tasks_insert_own on public.project_tasks for insert with check (auth.uid() = owner_id);
create policy project_tasks_update_own on public.project_tasks for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy project_tasks_delete_own on public.project_tasks for delete using (auth.uid() = owner_id);

create policy project_revisions_select_own on public.project_revisions for select using (auth.uid() = owner_id);
create policy project_revisions_insert_own on public.project_revisions for insert with check (auth.uid() = owner_id);
create policy project_revisions_update_own on public.project_revisions for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger project_tasks_set_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();
create trigger project_revisions_set_updated_at before update on public.project_revisions
  for each row execute function public.set_updated_at();

create or replace function public.set_project_task_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger project_tasks_set_timestamps before insert or update on public.project_tasks
  for each row execute function public.set_project_task_timestamps();

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
  if tg_op = 'DELETE' then
    select p.* into v_project
      from public.projects p
      join public.clients c on c.owner_id = p.owner_id and c.id = p.client_id
      where p.id = old.project_id and p.owner_id = old.owner_id;
    if not found then
      return old;
    end if;
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

create trigger project_tasks_log_event after update or delete on public.project_tasks
  for each row execute function public.log_project_task_event();

create or replace function public.set_project_revision_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
      if new.id is distinct from old.id
        or new.requested_at is distinct from old.requested_at
        or new.created_at is distinct from old.created_at
        or new.description is distinct from old.description
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

create trigger project_revisions_set_timestamps before insert or update on public.project_revisions
  for each row execute function public.set_project_revision_timestamps();

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

create trigger project_revisions_log_event after insert or update on public.project_revisions
  for each row execute function public.log_project_revision_event();

create or replace function public.enforce_contract_project_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allocated numeric;
begin
  -- Validação defensiva somente: authenticated não escreve contracts diretamente.
  -- A serialização ocorre nas RPCs de projeto e na correção de update_client da Task 3;
  -- adjust_contract será criada pelo Plano 3. Todas aguardam a advisory antes do UPDATE.
  if new.total_value is distinct from old.total_value then
    select coalesce(sum(contracted_value), 0) into v_allocated
      from public.projects
      where owner_id = new.owner_id and contract_id = new.id and status <> 'cancelled';
    if new.total_value < v_allocated then
      raise exception 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT: total % menor que projetos alocados %.',
        new.total_value, v_allocated using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger contracts_enforce_project_allocation before update of total_value on public.contracts
  for each row execute function public.enforce_contract_project_allocation();

revoke all on function public.set_project_task_timestamps() from public, anon, authenticated;
revoke all on function public.log_project_task_event() from public, anon, authenticated;
revoke all on function public.set_project_revision_timestamps() from public, anon, authenticated;
revoke all on function public.log_project_revision_event() from public, anon, authenticated;
revoke all on function public.enforce_contract_project_allocation() from public, anon, authenticated;

commit;
```

- [ ] **Step 2: Review RLS and trigger behavior**

Run: `git diff --check && git diff -- supabase/migrations/0008_etapa3_projects.sql`
Expected: tasks have owner CRUD policies; revisions have owner read/insert/update but no delete; both have composite owner/project FKs; direct task deletion logs only while the project/client still exist, so cascading deletion does not create an orphan activity; direct INSERT of a completed/approved revision is normalized and logged; approved revisions also reject changes to id, requested_at and created_at; the allocation trigger defensively rejects contract totals below the sum of non-cancelled projects without acquiring an advisory after the row; the project RPCs added in Task 3 and the corrected `update_client` will acquire `:contract:<id>` before any `FOR UPDATE`, while `adjust_contract` belongs to Plan 3; task writes and reorders share a transactional per-owner advisory lock; tables and trigger functions explicitly revoke `public` and `anon`, leaving only the minimum grants for `authenticated`; trigger functions are `security definer` with empty `search_path` and are never granted for direct client execution.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_etapa3_projects.sql
git commit -m "feat: criar tarefas e revisoes de projeto"
```

---

### Task 3: Implementar RPCs de projeto e validar alocação

**Files:**
- Create: `supabase/tests/etapa3_projects.sql`
- Modify: `supabase/migrations/0008_etapa3_projects.sql`

**Interfaces:**
- Produces: `create_project(jsonb)`, `update_project(uuid,jsonb)`, `set_project_status(uuid,text)`, `deliver_project(uuid,jsonb)`.
- Consumes: `public.contracts`, `public.projects`, `public.client_activities`.

**Contrato de alocação compartilhado com os Planos 1 e 3:**
- `authenticated` possui somente `SELECT` em `public.contracts`; toda escrita passa por RPC `security definer`. O Plano 2 corrige `update_client(uuid,jsonb)` para adquirir `pg_advisory_xact_lock(hashtextextended(owner_id || ':contract:' || contract_id, 0))` antes de qualquer row lock. `adjust_contract(uuid,numeric(14,2))` será criada pelo Plano 3 com a mesma ordem e não é chamada por este plano.
- Nenhuma das duas RPCs aceita total menor que `sum(projects.contracted_value)` com `status <> 'cancelled'`; a falha usa `23514` e o marcador `PROJECT_ALLOCATION_EXCEEDS_CONTRACT`.
- O Plano 1 pode manter a rejeição mais restrita `CONTRACT_ADJUST_REQUIRED` para toda mudança de total; ambos os erros preservam cliente, contrato e projetos por rollback transacional.
- O Plano 3 deve validar a alocação antes de reescrever parcelas. A trigger `contracts_enforce_project_allocation` desta migration é uma validação defensiva para UPDATE privilegiado, sem advisory própria; ela não substitui a serialização das RPCs.
- Toda RPC que altera um contrato existente adquire primeiro a advisory `:contract:<id>`; somente depois bloqueia projeto e/ou contrato. Nenhuma RPC pode segurar uma linha e esperar essa advisory.
- `set_project_status` adquire a mesma advisory antes de bloquear o projeto; ao entrar ou sair de `cancelled`, também bloqueia o contrato. Sair de cancelado exige contrato ativo e revalida a soma antes de gravar. A trigger de alocação não adquire lock e só complementa RPCs que já serializaram a operação ou UPDATEs diretos executados por um papel administrativo.

- [ ] **Step 1: Write the SQL contract test**

```sql
-- supabase/tests/etapa3_projects.sql
begin;

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_today date := DATE '2026-02-01';
  v_client jsonb;
  v_client_id uuid;
  v_contract_id uuid;
  v_project jsonb;
  v_second jsonb;
  v_project_id uuid;
  v_second_project_id uuid;
  v_delivered jsonb;
  v_repeated jsonb;
  v_delivered_at timestamptz;
  v_revision_id uuid;
  v_task_id uuid;
  v_deleted_task_id uuid;
  v_cascade_project_id uuid;
  v_cascade_task_id uuid;
  v_task_completed_at timestamptz;
  v_revision_approved_at timestamptz;
  v_archived_at timestamptz := '2026-02-03T04:05:06Z';
  v_invalid_value text;
  v_invalid_url text;
  v_update_client_definition text;
  v_events int;
begin
  -- O trigger handle_new_user cria o perfil; o rollback final remove usuários, perfis e dados.
  insert into auth.users (id, email)
  values
    (v_owner, 'etapa3-projects-owner-' || v_owner::text || '@example.test'),
    (v_other, 'etapa3-projects-' || v_other::text || '@example.test');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  v_update_client_definition := pg_catalog.lower(pg_catalog.pg_get_functiondef(
    'public.update_client(uuid,jsonb)'::pg_catalog.regprocedure
  ));
  if pg_catalog.strpos(v_update_client_definition, ':clients') = 0
    or pg_catalog.strpos(v_update_client_definition, ':clients')
      > pg_catalog.strpos(v_update_client_definition, ':contract:')
    or pg_catalog.strpos(v_update_client_definition, ':contract:') = 0
    or pg_catalog.strpos(v_update_client_definition, ':contract:')
      > pg_catalog.strpos(v_update_client_definition, 'for update') then
    raise exception 'update_client não adquiriu :clients e :contract antes do primeiro row lock.';
  end if;

  if has_table_privilege('anon', 'public.project_tasks', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_table_privilege('anon', 'public.project_revisions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    or has_function_privilege('anon', 'public.set_project_task_timestamps()', 'EXECUTE')
    or has_function_privilege('anon', 'public.log_project_task_event()', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_project_revision_timestamps()', 'EXECUTE')
    or has_function_privilege('anon', 'public.log_project_revision_event()', 'EXECUTE')
    or has_function_privilege('anon', 'public.enforce_contract_project_allocation()', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_project(jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.update_project(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_project_status(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.deliver_project(uuid,jsonb)', 'EXECUTE') then
    raise exception 'anon recebeu privilégio em objetos de projetos.';
  end if;

  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente de projeto',
    'service', 'Site', 'total_value', '1000.00', 'contracted_at', v_today
  ));
  v_client_id := ((v_client ->> 'client')::jsonb ->> 'id')::uuid;
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;

  v_project := public.create_project(jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto principal',
    'service', 'Site', 'contracted_value', '600.00',
    'start_date', v_today, 'due_date', v_today + 15,
    'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
  ));
  v_project_id := (v_project ->> 'id')::uuid;

  v_second := public.create_project(jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto complementar',
    'service', 'Conteúdo', 'contracted_value', '400.00',
    'start_date', v_today, 'due_date', v_today + 7,
    'responsible_name', null, 'priority', 'medium', 'description', null
  ));
  v_second_project_id := (v_second ->> 'id')::uuid;

  begin
    perform public.create_project(jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Projeto excedente',
      'service', 'Extra', 'contracted_value', '0.01',
      'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'low', 'description', null
    ));
    raise exception 'Alocação acima do contrato foi aceita.';
  exception when check_violation then
    if sqlerrm <> 'A soma dos projetos excede o valor do contrato.' then raise; end if;
  end;

  foreach v_invalid_value in array array['0.001', '1000000000000.00']::text[] loop
    begin
      perform public.create_project(jsonb_build_object(
        'client_id', v_client_id,
        'contract_id', v_contract_id, 'name', 'Projeto com valor inválido',
        'service', 'Extra', 'contracted_value', v_invalid_value,
        'start_date', v_today, 'due_date', v_today + 7,
        'responsible_name', null, 'priority', 'low', 'description', null
      ));
      raise exception 'create_project aceitou valor inválido: %', v_invalid_value;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Valor alocado inválido.' then raise; end if;
    end;

    begin
      perform public.update_project(v_project_id, jsonb_build_object(
        'client_id', v_client_id,
        'contract_id', v_contract_id, 'name', 'Projeto principal',
        'service', 'Site', 'contracted_value', v_invalid_value,
        'start_date', v_today, 'due_date', v_today + 15,
        'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
      ));
      raise exception 'update_project aceitou valor inválido: %', v_invalid_value;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Valor alocado inválido.' then raise; end if;
    end;
  end loop;

  if (select contracted_value from public.projects where id = v_project_id) <> 600.00
    or (select count(*) from public.projects where contract_id = v_contract_id) <> 2 then
    raise exception 'Valores inválidos alteraram projetos ou contratos.';
  end if;

  begin
    perform public.update_project(v_project_id, jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Projeto principal',
      'service', 'Site', 'contracted_value', '600.01',
      'start_date', v_today, 'due_date', v_today + 15,
      'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
    ));
    raise exception 'update_project aceitou projeto ativo acima da capacidade.';
  exception when check_violation then
    if sqlerrm <> 'A soma dos projetos excede o valor do contrato.' then raise; end if;
  end;
  if (select contracted_value from public.projects where id = v_project_id) <> 600.00
    or (select count(*) from public.projects where contract_id = v_contract_id) <> 2 then
    raise exception 'Falha por capacidade alterou projetos ativos.';
  end if;

  perform public.update_project(v_project_id, jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto principal',
    'service', 'Site', 'contracted_value', '600.00',
    'start_date', v_today, 'due_date', v_today + 15,
    'responsible_name', 'Responsável', 'priority', 'high',
    'description', 'Edição ativa dentro da capacidade'
  ));
  if (select description from public.projects where id = v_project_id)
      is distinct from 'Edição ativa dentro da capacidade' then
    raise exception 'Edição ativa dentro da capacidade não persistiu.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'note'
      and metadata ->> 'contracted_value_preserved' = 'false';
  if v_events <> 1 then
    raise exception 'Edição ativa não gerou exatamente um evento de atualização.';
  end if;

  begin
    perform public.update_client(
      v_client_id,
      (v_client ->> 'client')::jsonb || (v_client ->> 'contract')::jsonb || jsonb_build_object(
        'contract_id', v_contract_id, 'name', 'Nome que não deve persistir',
        'service', 'Site', 'total_value', '999.99', 'contracted_at', v_today
      )
    );
    raise exception 'update_client reduziu o total abaixo dos projetos.';
  exception when others then
    if sqlerrm = 'update_client reduziu o total abaixo dos projetos.' then raise; end if;
    if sqlstate <> '23514' or not (
      sqlerrm like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%'
      or sqlerrm like 'CONTRACT_ADJUST_REQUIRED:%'
    ) then raise; end if;
  end;
  if (select name from public.clients where id = v_client_id) <> 'Cliente de projeto'
    or (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'A falha de alocação não preservou cliente e contrato.';
  end if;

  -- adjust_contract é implementada e testada no Plano 3; este plano não pressupõe sua existência.

  -- UPDATE privilegiado continua encontrando a validação defensiva da trigger, sem advisory própria.
  begin
    update public.contracts set total_value = '999.99' where id = v_contract_id and owner_id = v_owner;
    raise exception 'Contrato ficou abaixo da alocação não cancelada.';
  exception when check_violation then
    if sqlerrm not like 'PROJECT_ALLOCATION_EXCEEDS_CONTRACT:%' then raise; end if;
  end;

  perform public.set_project_status(v_project_id, 'in_development');
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'status_change';
  if v_events <> 1 then
    raise exception 'Mudança de status não gerou um único evento.';
  end if;

  begin
    perform public.set_project_status(v_project_id, 'delivered');
    raise exception 'set_project_status aceitou delivered.';
  exception when check_violation then
    if sqlerrm <> 'Use o fluxo de entrega para marcar o projeto como entregue.' then raise; end if;
  end;
  if exists (
    select 1 from public.client_activities
    where project_id = v_project_id and metadata ->> 'new_status' = 'delivered'
  ) then
    raise exception 'Status direto gerou evento de entrega.';
  end if;

  foreach v_invalid_url in array array[
    'javascript:alert(1)',
    'ftp://example.test/arquivo',
    'https://example.test/com espaco',
    ' https://example.test/entrega'
  ]::text[] loop
    begin
      perform public.deliver_project(v_project_id, jsonb_build_object(
        'delivery_url', v_invalid_url,
        'files_url', 'https://example.test/arquivos-validos', 'confirmed', true
      ));
      raise exception 'deliver_project aceitou delivery_url inválida: %', v_invalid_url;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Informe uma URL HTTP(S) válida.' then raise; end if;
    end;

    begin
      perform public.deliver_project(v_project_id, jsonb_build_object(
        'delivery_url', 'https://example.test/entrega-valida',
        'files_url', v_invalid_url, 'confirmed', true
      ));
      raise exception 'deliver_project aceitou files_url inválida: %', v_invalid_url;
    exception when invalid_parameter_value then
      if sqlstate <> '22023' or sqlerrm <> 'Informe uma URL HTTP(S) válida.' then raise; end if;
    end;
  end loop;

  begin
    perform public.deliver_project(v_project_id, jsonb_build_object(
      'delivery_url', '', 'confirmed', true
    ));
    raise exception 'Entrega sem link foi aceita.';
  exception when invalid_parameter_value then
    if sqlstate <> '22023' or sqlerrm <> 'Informe o link de entrega.' then raise; end if;
  end;

  begin
    perform public.deliver_project(v_project_id, jsonb_build_object(
      'delivery_url', 'https://example.test/entrega-sem-confirmacao', 'confirmed', false
    ));
    raise exception 'Entrega sem confirmação explícita foi aceita.';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Confirme explicitamente a entrega.' then raise; end if;
  end;

  begin
    perform public.deliver_project(v_project_id, jsonb_build_object(
      'delivery_url', 'https://example.test/entrega-confirmacao-textual', 'confirmed', 'yes'
    ));
    raise exception 'Entrega aceitou confirmação textual como booleana.';
  exception when invalid_parameter_value then
    if sqlstate <> '22023' or sqlerrm <> 'Confirme explicitamente a entrega.' then raise; end if;
  end;

  v_delivered := public.deliver_project(v_project_id, jsonb_build_object(
    'delivery_url', 'https://example.test/primeira-entrega',
    'files_url', 'https://example.test/arquivos-originais',
    'final_notes', 'Primeira entrega', 'confirmed', true
  ));
  select delivered_at into v_delivered_at from public.projects where id = v_project_id;
  -- URLs inválidas no payload repetido provam que o retorno idempotente ocorre antes da validação.
  v_repeated := public.deliver_project(v_project_id, jsonb_build_object(
    'delivery_url', 'javascript:alert(1)',
    'files_url', 'ftp://example.test/arquivos-alterados',
    'final_notes', 'Não pode sobrescrever', 'confirmed', false
  ));
  if (v_repeated ->> 'delivery_url') is distinct from 'https://example.test/primeira-entrega'
    or (v_repeated ->> 'files_url') is distinct from 'https://example.test/arquivos-originais'
    or (v_repeated ->> 'final_notes') is distinct from 'Primeira entrega'
    or (v_repeated ->> 'delivered_at')::timestamptz is distinct from v_delivered_at
    or (v_repeated ->> 'delivery_confirmed_at')::timestamptz is null then
    raise exception 'Entrega repetida alterou a primeira entrega confirmada.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'delivery';
  if v_events <> 1 then
    raise exception 'Entrega repetida duplicou o evento.';
  end if;

  -- INSERT direto não pode criar aprovação sem timestamps e histórico.
  insert into public.project_revisions (owner_id, project_id, description, status)
  values (v_owner, v_project_id, 'Revisão aprovada por INSERT', 'approved')
  returning id into v_revision_id;
  if not exists (
    select 1 from public.project_revisions
    where id = v_revision_id and approved_at is not null and completed_at is not null
  ) then
    raise exception 'INSERT approved não recebeu timestamps.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'approval' and metadata ->> 'revision_id' = v_revision_id::text;
  if v_events <> 1 then
    raise exception 'INSERT approved não gerou exatamente um evento de aprovação.';
  end if;

  select approved_at into v_revision_approved_at from public.project_revisions where id = v_revision_id;
  update public.project_revisions set approved_at = '2000-01-01T00:00:00Z' where id = v_revision_id;
  if (select approved_at from public.project_revisions where id = v_revision_id) is distinct from v_revision_approved_at then
    raise exception 'O cliente sobrescreveu approved_at de uma revisão aprovada.';
  end if;
  begin
    update public.project_revisions set status = 'in_progress' where id = v_revision_id;
    raise exception 'Revisão aprovada voltou para outro status.';
  exception when check_violation then
    if sqlerrm <> 'Uma revisão aprovada não pode voltar para outro status.' then raise; end if;
  end;

  do $$
  declare
    v_original_description text;
  begin
    select description into v_original_description from public.project_revisions where id = v_revision_id;
    begin
      update public.project_revisions set description = 'Conteúdo sobrescrito após aprovação'
        where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de descrição.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    if (select description from public.project_revisions where id = v_revision_id) is distinct from v_original_description then
      raise exception 'Trigger não bloqueou alteração de descrição de revisão aprovada.';
    end if;
  end;

  do $$
  declare
    v_original_id uuid;
    v_original_requested_at timestamptz;
    v_original_created_at timestamptz;
  begin
    select id, requested_at, created_at into
      v_original_id, v_original_requested_at, v_original_created_at
      from public.project_revisions where id = v_revision_id;
    begin
      update public.project_revisions set id = gen_random_uuid() where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de id.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    begin
      update public.project_revisions set requested_at = '2000-01-01T00:00:00Z' where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de requested_at.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    begin
      update public.project_revisions set created_at = '2000-01-01T00:00:00Z' where id = v_revision_id;
      raise exception 'Revisão aprovada permitiu alteração de created_at.';
    exception when check_violation then
      if sqlerrm <> 'Uma revisão aprovada não pode ser alterada.' then raise; end if;
    end;
    if exists (
      select 1 from public.project_revisions
      where id = v_revision_id
        and (id is distinct from v_original_id
          or requested_at is distinct from v_original_requested_at
          or created_at is distinct from v_original_created_at)
    ) then
      raise exception 'Trigger não preservou identidade e datas da revisão aprovada.';
    end if;
  end;
  $$;

  insert into public.project_tasks (owner_id, project_id, title, status, completed_at)
  values (v_owner, v_project_id, 'Tarefa concluída pelo banco', 'completed', '2000-01-01T00:00:00Z')
  returning id into v_task_id;
  select completed_at into v_task_completed_at from public.project_tasks where id = v_task_id;
  if v_task_completed_at < now() - interval '1 minute' then
    raise exception 'INSERT completed aceitou completed_at informado pelo cliente.';
  end if;
  update public.project_tasks set completed_at = '2000-01-01T00:00:00Z' where id = v_task_id;
  if (select completed_at from public.project_tasks where id = v_task_id) is distinct from v_task_completed_at then
    raise exception 'O cliente sobrescreveu completed_at de uma tarefa concluída.';
  end if;

  insert into public.project_tasks (owner_id, project_id, title)
  values (v_owner, v_project_id, 'Tarefa excluída diretamente')
  returning id into v_deleted_task_id;
  delete from public.project_tasks where id = v_deleted_task_id and owner_id = v_owner;
  if not found then
    raise exception 'Exclusão direta da tarefa não removeu o registro.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_project_id and type = 'note'
      and metadata ->> 'task_id' = v_deleted_task_id::text;
  if v_events <> 1 then
    raise exception 'Exclusão direta da tarefa não gerou exatamente um evento.';
  end if;

  -- Projeto cancelado deixa de consumir o total do contrato.
  perform public.set_project_status(v_second_project_id, 'cancelled');
  update public.projects set archived_at = v_archived_at where id = v_second_project_id;
  perform public.set_project_status(v_second_project_id, 'cancelled');
  if (select archived_at from public.projects where id = v_second_project_id) is distinct from v_archived_at then
    raise exception 'Cancelamento repetido sobrescreveu archived_at.';
  end if;

  -- Uma chamada defensiva à RPC não realoca projeto cancelado: preserva 400,00 e registra a decisão.
  perform public.update_project(v_second_project_id, jsonb_build_object(
    'client_id', v_client_id,
    'contract_id', v_contract_id, 'name', 'Projeto complementar',
    'service', 'Conteúdo', 'contracted_value', '999.99',
    'start_date', v_today, 'due_date', v_today + 7,
    'responsible_name', null, 'priority', 'medium', 'description', null
  ));
  if (select contracted_value from public.projects where id = v_second_project_id) <> 400.00
    or (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'update_project realocou ou alterou a capacidade de um projeto cancelado.';
  end if;
  select count(*) into v_events from public.client_activities
    where project_id = v_second_project_id and type = 'note'
      and metadata ->> 'contracted_value_preserved' = 'true';
  if v_events <> 1 then
    raise exception 'update_project não registrou a preservação do valor do projeto cancelado.';
  end if;

  update public.contracts set total_value = '600.00' where id = v_contract_id and owner_id = v_owner;
  if (select total_value from public.contracts where id = v_contract_id) <> 600.00 then
    raise exception 'Projeto cancelado continuou bloqueando o saldo do contrato.';
  end if;

  begin
    perform public.set_project_status(v_second_project_id, 'not_started');
    raise exception 'Projeto cancelado voltou sem capacidade no contrato.';
  exception when check_violation then
    if sqlerrm <> 'A soma dos projetos excede o valor do contrato.' then raise; end if;
  end;
  if (select status from public.projects where id = v_second_project_id) <> 'cancelled'
    or (select archived_at from public.projects where id = v_second_project_id) is distinct from v_archived_at then
    raise exception 'Falha ao reativar projeto não preservou status e archived_at.';
  end if;

  update public.contracts set total_value = '1000.00' where id = v_contract_id and owner_id = v_owner;
  perform public.set_project_status(v_second_project_id, 'not_started');
  if (select archived_at from public.projects where id = v_second_project_id) is not null then
    raise exception 'Reativação bem-sucedida não limpou archived_at.';
  end if;

  update public.contracts set status = 'cancelled' where id = v_contract_id and owner_id = v_owner;
  begin
    perform public.update_project(v_project_id, jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Nome que não deve persistir',
      'service', 'Site', 'contracted_value', '600.01',
      'start_date', v_today, 'due_date', v_today + 15,
      'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
    ));
    raise exception 'update_project editou projeto com contrato cancelado.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm <> 'Contrato cancelado ou inativo não permite edição do projeto.' then raise; end if;
  end;
  if (select name from public.projects where id = v_project_id) <> 'Projeto principal' then
    raise exception 'A falha por contrato cancelado alterou o projeto.';
  end if;
  update public.contracts set status = 'active' where id = v_contract_id and owner_id = v_owner;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    update public.contracts set total_value = '0.01' where id = v_contract_id;
    raise exception 'UPDATE direto como authenticated foi aceito.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm not like 'permission denied%' then raise; end if;
  end;
  if (select total_value from public.contracts where id = v_contract_id) <> 1000.00 then
    raise exception 'UPDATE direto autenticado alterou o total do contrato.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  if exists (select 1 from public.projects where id = v_project_id) then
    raise exception 'RLS permitiu leitura de projeto de outro proprietário.';
  end if;
  if exists (select 1 from public.project_tasks where project_id = v_project_id) then
    raise exception 'RLS permitiu leitura de tarefa de outro proprietário.';
  end if;
  if exists (select 1 from public.project_revisions where project_id = v_project_id) then
    raise exception 'RLS permitiu leitura de revisão de outro proprietário.';
  end if;

  begin
    perform public.update_project(v_project_id, jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Alteração cross-owner',
      'service', 'Site', 'contracted_value', '600.00',
      'start_date', v_today, 'due_date', v_today + 15,
      'responsible_name', 'Responsável', 'priority', 'high', 'description', 'Teste'
    ));
    raise exception 'update_project permitiu alteração de projeto de outro proprietário.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm <> 'Projeto não encontrado ou acesso negado.' then raise; end if;
  end;

  begin
    perform public.create_project(jsonb_build_object(
      'client_id', v_client_id,
      'contract_id', v_contract_id, 'name', 'Criação cross-owner',
      'service', 'Site', 'contracted_value', '0.01',
      'start_date', v_today, 'due_date', v_today + 7,
      'responsible_name', null, 'priority', 'low', 'description', null
    ));
    raise exception 'create_project permitiu uso de contrato de outro proprietário.';
  exception when insufficient_privilege then
    if sqlstate <> '42501' or sqlerrm <> 'Contrato ativo não encontrado para este cliente.' then raise; end if;
  end;

  reset role;

  insert into public.projects (owner_id, client_id, contract_id, name, service, contracted_value)
  values (v_owner, v_client_id, v_contract_id, 'Projeto para cascata', 'Site', 0)
  returning id into v_cascade_project_id;
  insert into public.project_tasks (owner_id, project_id, title)
  values (v_owner, v_cascade_project_id, 'Tarefa removida pela cascata')
  returning id into v_cascade_task_id;
  delete from public.projects where id = v_cascade_project_id and owner_id = v_owner;
  if exists (select 1 from public.project_tasks where id = v_cascade_task_id) then
    raise exception 'Cascata do projeto não removeu a tarefa.';
  end if;
  if exists (
    select 1 from public.client_activities
    where project_id = v_cascade_project_id or metadata ->> 'task_id' = v_cascade_task_id::text
  ) then
    raise exception 'Cascata do projeto tentou criar histórico para uma tarefa sem projeto.';
  end if;

  raise notice 'Contrato SQL de projetos aprovado.';
end
$$;

rollback;
```

- [ ] **Step 2: Confirm the test is red**

Expected before implementation: `public.create_project(jsonb)` does not exist, so the complete contract test fails RED. Against a baseline implementation, the source-order assertion fails because `update_client` lacks `:contract:<id>`, the old numeric cast rounds `0.001` and the old delivery validation accepts non-HTTP schemes, so the new SQL assertions also fail before the fixes. Runtime execution requires migrations 0001–0008 applied by the user.

- [ ] **Step 3: Correct `update_client` lock order and insert project RPCs before `commit;`**

In `supabase/migrations/0008_etapa3_projects.sql`, replace `public.update_client(uuid,jsonb)` with the following definition. The replacement preserves its signature, validation, JSON return and privileges; it only reads `contract_id` earlier and acquires `:clients` then `:contract:<id>` before the first `FOR UPDATE`.

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

  v_contract_id := nullif(p_payload ->> 'contract_id', '')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':clients', 0)
  );
  if v_contract_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_contract_id::text, 0)
    );
  end if;

  select * into v_client from public.clients
    where id = p_client_id and owner_id = v_owner for update;
  if not found then
    raise exception 'Cliente não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  v_old_status := v_client.status;
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
```

Then insert the project RPCs in the same migration:

```sql
create or replace function public.create_project(p_payload jsonb)
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
  v_contract public.contracts;
  v_project public.projects;
  v_value numeric(14,2);
  v_value_text text;
  v_allocated numeric;
  v_start date;
  v_due date;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  v_client_id := (p_payload ->> 'client_id')::uuid;
  v_contract_id := (p_payload ->> 'contract_id')::uuid;
  v_value_text := nullif(pg_catalog.btrim(p_payload ->> 'contracted_value'), '');
  if v_value_text is null or v_value_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
    raise exception 'Valor alocado inválido.' using errcode = '22023';
  end if;
  v_value := v_value_text::numeric(14,2);
  v_start := nullif(p_payload ->> 'start_date', '')::date;
  v_due := nullif(p_payload ->> 'due_date', '')::date;
  if nullif(pg_catalog.btrim(p_payload ->> 'name'), '') is null
    or nullif(pg_catalog.btrim(p_payload ->> 'service'), '') is null then
    raise exception 'Informe nome e serviço do projeto.' using errcode = '22023';
  end if;
  if v_start is not null and v_due is not null and v_due < v_start then
    raise exception 'O prazo não pode anteceder o início.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_contract_id::text, 0)
  );
  select * into v_contract from public.contracts
    where id = v_contract_id and client_id = v_client_id and owner_id = v_owner and status = 'active'
    for update;
  if not found then raise exception 'Contrato ativo não encontrado para este cliente.' using errcode = '42501'; end if;

  select coalesce(sum(contracted_value), 0) into v_allocated from public.projects
    where owner_id = v_owner and contract_id = v_contract_id and status <> 'cancelled';
  if v_allocated + v_value > v_contract.total_value then
    raise exception 'A soma dos projetos excede o valor do contrato.' using errcode = '23514';
  end if;

  insert into public.projects (
    owner_id, client_id, contract_id, name, service, contracted_value,
    description, start_date, due_date, responsible_name, priority
  ) values (
    v_owner, v_client_id, v_contract_id, pg_catalog.btrim(p_payload ->> 'name'),
    pg_catalog.btrim(p_payload ->> 'service'), v_value,
    nullif(p_payload ->> 'description', ''), v_start, v_due,
    nullif(pg_catalog.btrim(p_payload ->> 'responsible_name'), ''),
    coalesce(nullif(p_payload ->> 'priority', ''), 'medium')
  ) returning * into v_project;

  insert into public.client_activities (owner_id, client_id, project_id, contract_id, type, description, metadata)
  values (v_owner, v_client_id, v_project.id, v_contract_id, 'note', 'Projeto criado: ' || v_project.name || '.',
    jsonb_build_object('contracted_value', v_value));
  return to_jsonb(v_project);
end;
$$;

create or replace function public.update_project(p_project_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_project public.projects;
  v_contract public.contracts;
  v_contract_id uuid;
  v_value numeric(14,2);
  v_value_text text;
  v_allocated numeric;
  v_preserve_value boolean;
  v_start date;
  v_due date;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select contract_id into v_contract_id from public.projects
    where id = p_project_id and owner_id = v_owner;
  if not found then raise exception 'Projeto não encontrado ou acesso negado.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_contract_id::text, 0)
  );
  select * into v_project from public.projects where id = p_project_id and owner_id = v_owner for update;
  if not found then raise exception 'Projeto não encontrado ou acesso negado.' using errcode = '42501'; end if;
  select * into v_contract from public.contracts where id = v_project.contract_id and owner_id = v_owner for update;
  if not found or v_contract.status <> 'active' then
    raise exception 'Contrato cancelado ou inativo não permite edição do projeto.' using errcode = '42501';
  end if;

  v_value_text := nullif(pg_catalog.btrim(p_payload ->> 'contracted_value'), '');
  if v_value_text is null or v_value_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' then
    raise exception 'Valor alocado inválido.' using errcode = '22023';
  end if;
  v_value := v_value_text::numeric(14,2);
  v_start := nullif(p_payload ->> 'start_date', '')::date;
  v_due := nullif(p_payload ->> 'due_date', '')::date;
  if nullif(pg_catalog.btrim(p_payload ->> 'name'), '') is null
    or nullif(pg_catalog.btrim(p_payload ->> 'service'), '') is null then
    raise exception 'Informe nome e serviço do projeto.' using errcode = '22023';
  end if;
  if v_start is not null and v_due is not null and v_due < v_start then
    raise exception 'O prazo não pode anteceder o início.' using errcode = '22023';
  end if;

  v_preserve_value := v_project.status = 'cancelled';
  if v_preserve_value then
    -- Projeto cancelado não consome capacidade: preserva o valor atual sem somar o payload.
    v_value := v_project.contracted_value;
  else
    select coalesce(sum(contracted_value), 0) into v_allocated from public.projects
      where owner_id = v_owner and contract_id = v_project.contract_id
        and status <> 'cancelled' and id <> v_project.id;
    if v_allocated + v_value > v_contract.total_value then
      raise exception 'A soma dos projetos excede o valor do contrato.' using errcode = '23514';
    end if;
  end if;

  update public.projects set
    name = pg_catalog.btrim(p_payload ->> 'name'),
    service = pg_catalog.btrim(p_payload ->> 'service'),
    contracted_value = v_value,
    description = nullif(p_payload ->> 'description', ''),
    start_date = v_start,
    due_date = v_due,
    responsible_name = nullif(pg_catalog.btrim(p_payload ->> 'responsible_name'), ''),
    priority = coalesce(nullif(p_payload ->> 'priority', ''), v_project.priority)
  where id = p_project_id and owner_id = v_owner returning * into v_project;

  insert into public.client_activities (owner_id, client_id, project_id, contract_id, type, description, metadata)
  values (
    v_owner, v_project.client_id, v_project.id, v_project.contract_id, 'note',
    case when v_preserve_value
      then 'Projeto cancelado atualizado: ' || v_project.name || '. Valor preservado sem realocação.'
      else 'Projeto atualizado: ' || v_project.name || '.'
    end,
    jsonb_build_object('contracted_value_preserved', v_preserve_value)
  );
  return to_jsonb(v_project);
end;
$$;

create or replace function public.set_project_status(p_project_id uuid, p_status text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_project public.projects;
  v_contract public.contracts;
  v_contract_id uuid;
  v_allocated numeric;
  v_old text;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select contract_id into v_contract_id from public.projects
    where id = p_project_id and owner_id = v_owner;
  if not found then raise exception 'Projeto não encontrado ou acesso negado.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || v_contract_id::text, 0)
  );
  select * into v_project from public.projects where id = p_project_id and owner_id = v_owner for update;
  if not found then raise exception 'Projeto não encontrado ou acesso negado.' using errcode = '42501'; end if;
  if p_status = 'delivered' then
    raise exception 'Use o fluxo de entrega para marcar o projeto como entregue.' using errcode = '23514';
  end if;
  if v_project.status = 'delivered' then
    raise exception 'Projeto entregue não pode voltar para outro status.' using errcode = '23514';
  end if;
  if p_status is null or p_status not in (
    'not_started','planning','in_development','awaiting_client_info',
    'in_review','awaiting_approval','changes_requested','completed','cancelled'
  ) then
    raise exception 'Status de projeto inválido.' using errcode = '22023';
  end if;
  v_old := v_project.status;
  if v_old = 'cancelled' or p_status = 'cancelled' then
    select * into v_contract from public.contracts
      where id = v_project.contract_id and owner_id = v_owner for update;
    if not found then raise exception 'Contrato não encontrado ou acesso negado.' using errcode = '42501'; end if;
    if p_status <> 'cancelled' then
      if v_contract.status <> 'active' then raise exception 'Contrato ativo não encontrado.' using errcode = '42501'; end if;
      select coalesce(sum(contracted_value), 0) into v_allocated from public.projects
        where owner_id = v_owner and contract_id = v_contract.id
          and status <> 'cancelled' and id <> v_project.id;
      if v_allocated + v_project.contracted_value > v_contract.total_value then
        raise exception 'A soma dos projetos excede o valor do contrato.' using errcode = '23514';
      end if;
    end if;
  end if;
  update public.projects set
    status = p_status,
    completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else completed_at end,
    archived_at = case when p_status = 'cancelled' then coalesce(archived_at, now()) else null end
  where id = p_project_id and owner_id = v_owner returning * into v_project;
  if v_old is distinct from p_status then
    insert into public.client_activities (owner_id, client_id, project_id, contract_id, type, description, metadata)
    values (v_owner, v_project.client_id, v_project.id, v_project.contract_id, 'status_change',
      'Status do projeto alterado de ' || v_old || ' para ' || p_status || '.',
      jsonb_build_object('previous_status', v_old, 'new_status', p_status));
  end if;
  return to_jsonb(v_project);
end;
$$;

create or replace function public.deliver_project(p_project_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_project public.projects;
  v_delivery_url text;
  v_files_url text;
  v_confirmed boolean;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  select * into v_project from public.projects where id = p_project_id and owner_id = v_owner for update;
  if not found then raise exception 'Projeto não encontrado ou acesso negado.' using errcode = '42501'; end if;
  if v_project.status = 'delivered' then
    return to_jsonb(v_project);
  end if;
  if v_project.status = 'cancelled' then raise exception 'Projeto cancelado não pode ser entregue.' using errcode = '23514'; end if;

  v_delivery_url := p_payload ->> 'delivery_url';
  v_files_url := p_payload ->> 'files_url';
  if pg_catalog.jsonb_typeof(p_payload -> 'confirmed') is distinct from 'boolean' then
    raise exception 'Confirme explicitamente a entrega.' using errcode = '22023';
  end if;
  v_confirmed := (p_payload ->> 'confirmed')::boolean;
  if nullif(pg_catalog.btrim(v_delivery_url), '') is null then
    raise exception 'Informe o link de entrega.' using errcode = '22023';
  end if;
  if v_delivery_url !~* '^https?://[^/?#[:space:]]+([/?#][^[:space:]]*)?$' then
    raise exception 'Informe uma URL HTTP(S) válida.' using errcode = '22023';
  end if;
  if v_files_url is not null and v_files_url <> ''
    and v_files_url !~* '^https?://[^/?#[:space:]]+([/?#][^[:space:]]*)?$' then
    raise exception 'Informe uma URL HTTP(S) válida.' using errcode = '22023';
  end if;
  if v_confirmed is distinct from true then raise exception 'Confirme explicitamente a entrega.' using errcode = '22023'; end if;

  update public.projects set
    status = 'delivered', delivery_url = v_delivery_url,
    files_url = nullif(v_files_url, ''),
    final_notes = nullif(p_payload ->> 'final_notes', ''),
    delivered_at = now(), completed_at = coalesce(completed_at, now()),
    delivery_confirmed_at = case when v_confirmed then now() else null end,
    archived_at = null
  where id = p_project_id and owner_id = v_owner returning * into v_project;
  insert into public.client_activities (owner_id, client_id, project_id, contract_id, type, description, metadata)
  values (v_owner, v_project.client_id, v_project.id, v_project.contract_id, 'delivery',
    'Projeto entregue: ' || v_project.name || '.',
    jsonb_build_object('delivery_url', v_delivery_url, 'confirmed', v_confirmed));
  return to_jsonb(v_project);
end;
$$;

revoke all on function public.create_project(jsonb) from public, anon, authenticated;
revoke all on function public.update_project(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_project_status(uuid, text) from public, anon, authenticated;
revoke all on function public.deliver_project(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_project(jsonb) to authenticated;
grant execute on function public.update_project(uuid, jsonb) to authenticated;
grant execute on function public.set_project_status(uuid, text) to authenticated;
grant execute on function public.deliver_project(uuid, jsonb) to authenticated;
```

- [ ] **Step 4: Review invariants and run the SQL contract test (GREEN)**

After applying the RPCs, rerun the complete `supabase/tests/etapa3_projects.sql` in the SQL Editor.
Expected: PASS with notice `Contrato SQL de projetos aprovado.`; `create_project` and `update_project` reject `0.001` and `1000000000000.00` with `22023`; `update_client` rejects a total below the active allocation; a privileged direct UPDATE is rejected by the defensive trigger; a direct authenticated UPDATE of `contracts` fails with `42501` and preserves the total; repeated cancellation preserves the fixture timestamp and successful reactivation clears it; `update_project` preserves a cancelled project's current value, does not reallocate it and records `contracted_value_preserved = true`; editing through a cancelled contract fails with a clear `42501`; invalid delivery/files URLs are rejected, the valid HTTPS delivery passes, and repeated delivery ignores a new invalid payload. The `adjust_contract` allocation assertion remains exclusively in Plan 3, where that RPC is created.

Then run: `git diff --check`
Expected: `update_client` acquires the contract advisory before any row lock and before the allocation sum; `adjust_contract` is not present until Plan 3; the allocation trigger validates without acquiring an advisory; cancelled projects are excluded from active allocation; update replaces only the current active project allocation, while a cancelled project preserves its value; entering/leaving `cancelled` shares the contract advisory and row lock and leaving it revalidates capacity; `set_project_status` rejects `delivered` and cannot revert a delivered project; first delivery requires a non-empty HTTP(S) URL without whitespace and `confirmed = true`; repeated `deliver_project` returns before validating the new payload and without another event; every project RPC validates owner and logs mutations; no RPC writes financial tables.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_etapa3_projects.sql supabase/tests/etapa3_projects.sql
git commit -m "feat: adicionar RPCs e alocacao de projetos"
```

---

### Task 4: Implementar ordenação de tarefas e serviços de tarefas/revisões

**Files:**
- Modify: `supabase/migrations/0008_etapa3_projects.sql`
- Modify: `supabase/tests/etapa3_projects.sql`
- Create: `supabase/tests/etapa3_task_concurrency.sql`
- Create: `src/services/projectTaskService.ts`
- Create: `src/services/projectTaskService.test.ts`
- Create: `src/services/projectRevisionService.ts`
- Create: `src/services/projectRevisionService.test.ts`

**Interfaces:**
- Produces: `reorder_project_tasks(uuid,uuid[]) returns jsonb`.
- Produces:
  - `listTasks(projectId)`, `createTask(projectId,input)`, `updateTask(id,input)`, `deleteTask(id)`, `reorderTasks(projectId,orderedIds)`.
  - `listRevisions(projectId)`, `createRevision(projectId,input)`, `updateRevision(id,input)`.

- [ ] **Step 1: Write failing service and reorder contract tests**

```ts
// src/services/projectTaskService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc, from })) }
})

import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from './projectTaskService'

const taskInput = {
  title: 'Criar layout', description: '', status: 'pending' as const, responsibleName: '',
  startDate: null, dueDate: null, priority: 'high' as const, notes: '',
}

describe('projectTaskService', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('cria tarefa com payload normalizado', async () => {
    const query = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    const result = await createTask('project-1', taskInput)
    expect(query.insert).toHaveBeenCalledWith({
      project_id: 'project-1', title: 'Criar layout', description: null,
      status: 'pending', responsible_name: null, start_date: null, due_date: null,
      priority: 'high', notes: null,
    })
    expect(result.id).toBe('task-1')
  })

  it('listTasks orders by position and id', async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [{ id: 'task-1' }], error: null })
    from.mockReturnValue(query)
    const result = await listTasks('project-1')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.eq).toHaveBeenCalledWith('project_id', 'project-1')
    expect(query.order).toHaveBeenNthCalledWith(1, 'position')
    expect(query.order).toHaveBeenNthCalledWith(2, 'id')
    expect(result).toEqual([{ id: 'task-1' }])
  })

  it('updateTask envia o payload completo sem timestamps', async () => {
    const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    await updateTask('task-1', { ...taskInput, status: 'completed', description: 'Pronto' })
    expect(query.update).toHaveBeenCalledWith({
      title: 'Criar layout', description: 'Pronto', status: 'completed', responsible_name: null,
      start_date: null, due_date: null, priority: 'high', notes: null,
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
    expect(JSON.stringify(query.update.mock.calls[0][0])).not.toContain('completed_at')
  })

  it('deleteTask usa delete e informa linha ausente', async () => {
    const query = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null }) }
    from.mockReturnValue(query)
    await expect(deleteTask('task-1')).resolves.toEqual({ id: 'task-1' })
    expect(query.delete).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
    expect(query.maybeSingle).toHaveBeenCalled()
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(deleteTask('task-1')).rejects.toThrow('Tarefa não encontrada ou já excluída.')
  })

  it('reorderTasks envia a lista completa sem filtrar ou ordenar', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    await reorderTasks('project-1', ['task-cancelled', 'task-2', 'task-1'])
    expect(rpc).toHaveBeenCalledWith('reorder_project_tasks', {
      p_project_id: 'project-1', p_ordered_ids: ['task-cancelled', 'task-2', 'task-1'],
    })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(reorderTasks('project-1', [])).rejects.toThrow('Resposta inválida ao reordenar tarefas.')
  })
})
```

```ts
// src/services/projectRevisionService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ from })) }
})

import { createRevision, listRevisions, updateRevision } from './projectRevisionService'

describe('projectRevisionService', () => {
  beforeEach(() => from.mockReset())

  it('createRevision normaliza responsável e notas vazios', async () => {
    const query = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'revision-1' }, error: null }) }
    from.mockReturnValue(query)
    await createRevision('project-1', { description: 'Ajustar banner', responsibleName: '', status: 'requested', notes: '' })
    expect(query.insert).toHaveBeenCalledWith({
      project_id: 'project-1', description: 'Ajustar banner', responsible_name: null,
      status: 'requested', notes: null,
    })
  })

  it('listRevisions orders newest first', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [{ id: 'revision-1' }], error: null }) }
    from.mockReturnValue(query)
    await expect(listRevisions('project-1')).resolves.toEqual([{ id: 'revision-1' }])
    expect(query.order).toHaveBeenCalledWith('requested_at', { ascending: false })
  })

  it('aprova por update sem escrever approved_at', async () => {
    const query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'revision-1', status: 'approved' }, error: null }) }
    from.mockReturnValue(query)
    const result = await updateRevision('revision-1', {
      description: 'Ajustar banner', responsibleName: '', status: 'approved', notes: '',
    })
    expect(query.update).toHaveBeenCalledWith({
      description: 'Ajustar banner', responsible_name: null, status: 'approved', notes: null,
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'revision-1')
    expect(JSON.stringify(query.update.mock.calls[0][0])).not.toContain('approved_at')
    expect(result.status).toBe('approved')
  })
})
```

Acrescente este segundo bloco `do` imediatamente antes do `rollback;` final de `supabase/tests/etapa3_projects.sql`:

```sql
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_today date := DATE '2026-02-01';
  v_client jsonb;
  v_contract_id uuid;
  v_project_id uuid;
  v_ids uuid[];
  v_expected uuid[];
  v_actual uuid[];
  v_positions integer[];
begin
  insert into auth.users (id, email)
  values (v_owner, 'etapa3-projects-order-' || v_owner::text || '@example.test');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  v_client := public.create_client(jsonb_build_object(
    'creation_key', gen_random_uuid(), 'name', 'Cliente de ordenação',
    'service', 'Site', 'total_value', '0.00', 'contracted_at', v_today
  ));
  v_contract_id := ((v_client ->> 'contract')::jsonb ->> 'id')::uuid;
  v_project_id := (public.create_project(jsonb_build_object(
    'client_id', (v_client ->> 'client')::jsonb ->> 'id',
    'contract_id', v_contract_id, 'name', 'Projeto de ordenação',
    'service', 'Site', 'contracted_value', '0.00'
  )) ->> 'id')::uuid;

  select array_agg(id order by title) into v_ids
  from (
    insert into public.project_tasks (owner_id, project_id, title)
    values
      (v_owner, v_project_id, 'A'),
      (v_owner, v_project_id, 'B'),
      (v_owner, v_project_id, 'C')
    returning id, title
  ) as inserted;
  v_expected := array[v_ids[3], v_ids[1], v_ids[2]];

  perform public.reorder_project_tasks(v_project_id, v_expected);
  select array_agg(id order by position), array_agg(position order by position)
    into v_actual, v_positions
  from public.project_tasks where project_id = v_project_id and owner_id = v_owner;
  if v_actual is distinct from v_expected or v_positions is distinct from array[0,1,2] then
    raise exception 'Reordenação não persistiu a ordem completa e contígua.';
  end if;

  begin
    perform public.reorder_project_tasks(v_project_id, array[]::uuid[]);
    raise exception 'Reordenação aceitou lista vazia.';
  exception when invalid_parameter_value then
    if sqlerrm <> 'A ordem deve conter todas as tarefas do projeto.' then raise; end if;
  end;

  begin
    perform public.reorder_project_tasks(v_project_id, v_ids[1:2]);
    raise exception 'Reordenação aceitou conjunto incompleto.';
  exception when invalid_parameter_value then
    if sqlerrm <> 'A ordem deve conter todas as tarefas do projeto.' then raise; end if;
  end;

  begin
    perform public.reorder_project_tasks(v_project_id, array[v_ids[1], v_ids[1], v_ids[2]]);
    raise exception 'Reordenação aceitou ID duplicado.';
  exception when invalid_parameter_value then
    if sqlerrm <> 'A ordem contém tarefas inválidas ou duplicadas.' then raise; end if;
  end;

  begin
    perform public.reorder_project_tasks(v_project_id, array[v_ids[1], v_ids[2], gen_random_uuid()]);
    raise exception 'Reordenação aceitou tarefa de outro projeto.';
  exception when invalid_parameter_value then
    if sqlerrm <> 'A ordem contém tarefas inválidas ou duplicadas.' then raise; end if;
  end;

  select array_agg(id order by position) into v_actual
  from public.project_tasks where project_id = v_project_id and owner_id = v_owner;
  if v_actual is distinct from v_expected then
    raise exception 'Reordenação inválida alterou a última ordem válida.';
  end if;
end
$$;
```

Crie `supabase/tests/etapa3_task_concurrency.sql` com o harness abaixo. Ele executa seis probes bidirecionais: INSERT, UPDATE e DELETE diretos contra reordenação, nos dois sentidos. Cada probe confirma a advisory com `pg_try_advisory_xact_lock`, exige `55P03` na operação bloqueada e trata `40P01` como falha. Após o rollback remoto, o `SET LOCAL ROLE authenticated` deixa de existir; o cleanup abre uma nova transação, executa `RESET ROLE` para garantir o papel privilegiado atual, restaura `request.jwt.claim.sub` antes dos DELETE e nunca usa `SET LOCAL ROLE authenticated` para excluir cliente, contrato ou projeto. No exception handler, rollback, cleanup e disconnect de cada conexão têm blocos individuais para não mascarar o erro primário.

```sql
create extension if not exists dblink;

do $$
declare
  v_conn_a text := 'task_concurrency_a_' || gen_random_uuid()::text;
  v_conn_b text := 'task_concurrency_b_' || gen_random_uuid()::text;
  v_owner uuid := gen_random_uuid();
  v_today date := DATE '2026-02-01';
  v_client_id uuid;
  v_project_id uuid;
  v_task_ids uuid[];
  v_order uuid[];
  v_result text;
  v_cleanup_sql text;
  v_setup_committed boolean := false;
  v_state text;
  v_operation text;
  v_direction int;
  v_direct_sql text;
  v_reorder_sql text;
begin
  begin
    perform dblink_connect(v_conn_a, format('dbname=%L user=%L', current_database(), current_user));
    perform dblink_connect(v_conn_b, format('dbname=%L user=%L', current_database(), current_user));
    perform dblink_exec(v_conn_a, 'begin');
    perform dblink_exec(v_conn_a, format(
      'insert into auth.users (id, email) values (%L::uuid, %L)',
      v_owner::text, 'etapa3-task-concurrency-' || v_owner::text || '@example.test'
    ));
    perform dblink_exec(v_conn_a, 'set local role authenticated');
    perform dblink_exec(v_conn_a, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
    select dblink_eval(v_conn_a, format(
      'select public.create_client(%L::jsonb)',
      jsonb_build_object(
        'creation_key', gen_random_uuid(), 'name', 'Cliente de concorrência de tarefas',
        'service', 'Site', 'total_value', '0.00', 'contracted_at', v_today
      )::text
    )) into v_result;
    v_client_id := ((v_result::jsonb ->> 'client')::jsonb ->> 'id')::uuid;
    select dblink_eval(v_conn_a, format(
      'select public.create_project(%L::jsonb)',
      jsonb_build_object(
        'client_id', v_client_id,
        'contract_id', ((v_result::jsonb ->> 'contract')::jsonb ->> 'id')::uuid,
        'name', 'Projeto de concorrência de tarefas', 'service', 'Site', 'contracted_value', '0.00'
      )::text
    )) into v_result;
    v_project_id := (v_result::jsonb ->> 'id')::uuid;
    select dblink_eval(v_conn_a, format($fixture$
      select array_agg(id order by title) from (
        insert into public.project_tasks (owner_id, project_id, title)
        values (%1$L::uuid, %2$L::uuid, 'A'), (%1$L::uuid, %2$L::uuid, 'B')
        returning id, title
      ) as inserted
    $fixture$, v_owner::text, v_project_id::text)) into v_result;
    v_task_ids := v_result::uuid[];
    v_order := array[v_task_ids[2], v_task_ids[1]];

    -- O rollback remoto desfaz SET LOCAL ROLE authenticated. O cleanup garante o papel
    -- privilegiado da conexão, restaura a claim e nunca exclui dados como authenticated.
    v_cleanup_sql := format($cleanup$
      begin;
      reset role;
      select set_config('request.jwt.claim.sub', %3$L, true);
      delete from public.project_revisions where project_id = %1$L::uuid;
      delete from public.project_tasks where project_id = %1$L::uuid;
      delete from public.client_activities where client_id = %2$L::uuid;
      delete from public.projects where id = %1$L::uuid;
      delete from public.contracts where client_id = %2$L::uuid;
      delete from public.clients where id = %2$L::uuid;
      delete from auth.users where id = %3$L::uuid;
      commit;
    $cleanup$, v_project_id::text, v_client_id::text, v_owner::text);
    perform dblink_exec(v_conn_a, 'commit');
    v_setup_committed := true;

    v_reorder_sql := format(
      'select public.reorder_project_tasks(%L::uuid, %L::uuid[])', v_project_id::text, v_order::text
    );
    foreach v_operation in array array['insert', 'update', 'delete'] loop
      v_direct_sql := case v_operation
        when 'insert' then format(
          'insert into public.project_tasks (owner_id, project_id, title) values (%L::uuid, %L::uuid, %L)',
          v_owner::text, v_project_id::text, 'Probe INSERT'
        )
        when 'update' then format(
          'update public.project_tasks set notes = %L where id = %L::uuid',
          'Probe UPDATE', v_task_ids[1]::text
        )
        else format(
          'delete from public.project_tasks where id = %L::uuid', v_task_ids[1]::text
        )
      end;

      -- Direção 1: escrita direta na A bloqueia a reordenação na B.
      -- Direção 2: reordenação na A bloqueia a mesma escrita direta na B.
      for v_direction in 1..2 loop
        perform dblink_exec(v_conn_a, 'begin');
        perform dblink_exec(v_conn_a, 'set local role authenticated');
        perform dblink_exec(v_conn_a, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
        if v_direction = 1 then
          perform dblink_exec(v_conn_a, v_direct_sql);
        else
          perform dblink_exec(v_conn_a, v_reorder_sql);
        end if;

        perform dblink_exec(v_conn_b, 'begin');
        perform dblink_exec(v_conn_b, 'set local role authenticated');
        perform dblink_exec(v_conn_b, format('select set_config(''request.jwt.claim.sub'', %L, true)', v_owner::text));
        perform dblink_exec(v_conn_b, 'set local lock_timeout = ''1s''');
        select dblink_eval(v_conn_b, format(
          'select pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(%L || '':project_tasks'', 0))', v_owner::text
        )) into v_result;
        if v_result <> 'f' then
          raise exception 'A advisory de tarefas não foi confirmada no probe %/% na conexão B.',
            v_operation, v_direction;
        end if;

        begin
          if v_direction = 1 then
            perform dblink_exec(v_conn_b, v_reorder_sql);
          else
            perform dblink_exec(v_conn_b, v_direct_sql);
          end if;
          raise exception 'Probe %/% ignorou a advisory de tarefas.', v_operation, v_direction;
        exception when others then
          get stacked diagnostics v_state = returned_sqlstate;
          if v_state <> '55P03' then raise; end if;
        end;
        perform dblink_exec(v_conn_b, 'rollback');
        perform dblink_exec(v_conn_a, 'rollback');
      end loop;
    end loop;
  exception when others then
    if v_conn_a = any(dblink_get_connections()) then
      begin perform dblink_exec(v_conn_a, 'rollback'); exception when others then raise notice 'Falha no rollback A: %', sqlerrm; end;
      if v_setup_committed and v_cleanup_sql is not null then
        begin perform dblink_exec(v_conn_a, v_cleanup_sql); exception when others then raise notice 'Falha no cleanup A: %', sqlerrm; end;
      end if;
      begin perform dblink_disconnect(v_conn_a); exception when others then raise notice 'Falha no disconnect A: %', sqlerrm; end;
    end if;
    if v_conn_b = any(dblink_get_connections()) then
      begin perform dblink_exec(v_conn_b, 'rollback'); exception when others then raise notice 'Falha no rollback B: %', sqlerrm; end;
      begin perform dblink_disconnect(v_conn_b); exception when others then raise notice 'Falha no disconnect B: %', sqlerrm; end;
    end if;
    raise;
  end;

  if v_conn_a = any(dblink_get_connections()) then
    perform dblink_exec(v_conn_a, 'rollback');
    if v_setup_committed and v_cleanup_sql is not null then perform dblink_exec(v_conn_a, v_cleanup_sql); end if;
    perform dblink_disconnect(v_conn_a);
  end if;
  if v_conn_b = any(dblink_get_connections()) then
    perform dblink_exec(v_conn_b, 'rollback');
    perform dblink_disconnect(v_conn_b);
  end if;
  raise notice 'Concorrência de INSERT, UPDATE e DELETE diretos com reordenação aprovada nas duas direções.';
end
$$;
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/projectTaskService.test.ts src/services/projectRevisionService.test.ts`
Expected: FAIL with modules not found.

Após aplicar a migration anterior sem a RPC de reordenação, execute `supabase/tests/etapa3_task_concurrency.sql` no SQL Editor.
Expected: FAIL na primeira confirmação de lock ou na chamada de `reorder_project_tasks`, pois a serialização ainda não existe.

- [ ] **Step 3: Implement the reorder RPC**

A reordenação é `security definer` porque precisa adquirir a mesma advisory por proprietário usada pela trigger `BEFORE STATEMENT` do CRUD direto e, só depois, bloquear o projeto pai e todas as tarefas por `id`. Assim, nenhuma transação segura uma linha enquanto espera essa advisory; INSERT, UPDATE, DELETE e reordenação serializam as mutações de tarefas do usuário sem deadlock.

Insert before `commit;`:

```sql
create or replace function public.lock_project_task_mutations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':project_tasks', 0)
  );
  return null;
end;
$$;

create trigger project_tasks_lock_mutations before insert or update or delete on public.project_tasks
  for each statement execute function public.lock_project_task_mutations();

revoke all on function public.lock_project_task_mutations() from public, anon, authenticated;

create or replace function public.reorder_project_tasks(p_project_id uuid, p_ordered_ids uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_project public.projects;
  v_position int;
  v_task_id uuid;
begin
  if v_owner is null then raise exception 'Sessão autenticada necessária.' using errcode = '42501'; end if;
  if coalesce(cardinality(p_ordered_ids), 0) = 0 then
    raise exception 'A ordem deve conter todas as tarefas do projeto.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':project_tasks', 0)
  );
  select * into v_project from public.projects
    where id = p_project_id and owner_id = v_owner for update;
  if not found then raise exception 'Projeto não encontrado ou acesso negado.' using errcode = '42501'; end if;
  perform id from public.project_tasks
    where project_id = p_project_id and owner_id = v_owner
    order by id for update;
  if (select count(*) from public.project_tasks where project_id = p_project_id and owner_id = v_owner)
      <> coalesce(cardinality(p_ordered_ids), 0) then
    raise exception 'A ordem deve conter todas as tarefas do projeto.' using errcode = '22023';
  end if;
  if (select count(distinct id) from public.project_tasks where project_id = p_project_id and owner_id = v_owner and id = any(p_ordered_ids))
      <> coalesce(cardinality(p_ordered_ids), 0) then
    raise exception 'A ordem contém tarefas inválidas ou duplicadas.' using errcode = '22023';
  end if;

  for v_position, v_task_id in select ordinality, value from unnest(p_ordered_ids) with ordinality loop
    update public.project_tasks set position = v_position - 1
      where id = v_task_id and project_id = p_project_id and owner_id = v_owner;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reorder_project_tasks(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_project_tasks(uuid, uuid[]) to authenticated;
```

- [ ] **Step 4: Implement task and revision services**

```ts
// src/services/projectTaskService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { ProjectTask, ProjectTaskWrite } from '../types/project'

function nullable(value: string | null): string | null {
  return value?.trim() ? value.trim() : null
}

function taskPayload(input: ProjectTaskWrite) {
  return {
    title: input.title,
    description: nullable(input.description),
    status: input.status,
    responsible_name: nullable(input.responsibleName),
    start_date: input.startDate,
    due_date: input.dueDate,
    priority: input.priority,
    notes: nullable(input.notes),
  }
}

function taskRow<T>(data: T | null): T {
  if (!data) throw new Error('Resposta inválida ao salvar tarefa.')
  return data
}

export async function listTasks(projectId: string): Promise<ProjectTask[]> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').select('*').eq('project_id', projectId)
    .order('position').order('id')
  throwDbError(error)
  return data ?? []
}

export async function createTask(projectId: string, input: ProjectTaskWrite): Promise<ProjectTask> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').insert({ project_id: projectId, ...taskPayload(input) })
    .select('*').single()
  throwDbError(error)
  return taskRow(data) as ProjectTask
}

export async function updateTask(id: string, input: ProjectTaskWrite): Promise<ProjectTask> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').update(taskPayload(input)).eq('id', id).select('*').single()
  throwDbError(error)
  return taskRow(data) as ProjectTask
}

export async function deleteTask(id: string): Promise<{ id: string }> {
  const { data, error } = await requireSupabase()
    .from('project_tasks').delete().eq('id', id).select('id').maybeSingle()
  throwDbError(error)
  if (!data) throw new Error('Tarefa não encontrada ou já excluída.')
  return data
}

export async function reorderTasks(projectId: string, orderedIds: string[]): Promise<void> {
  const { data, error } = await requireSupabase().rpc('reorder_project_tasks', {
    p_project_id: projectId, p_ordered_ids: orderedIds,
  })
  throwDbError(error)
  if (!data || typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    throw new Error('Resposta inválida ao reordenar tarefas.')
  }
}
```

```ts
// src/services/projectRevisionService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import type { ProjectRevision, ProjectRevisionWrite } from '../types/project'

function nullable(value: string): string | null {
  return value.trim() ? value.trim() : null
}

function revisionPayload(input: ProjectRevisionWrite) {
  return {
    description: input.description,
    responsible_name: nullable(input.responsibleName),
    status: input.status,
    notes: nullable(input.notes),
  }
}

function revisionRow(data: unknown): ProjectRevision {
  if (!data || typeof data !== 'object') throw new Error('Resposta inválida ao salvar revisão.')
  return data as ProjectRevision
}

export async function listRevisions(projectId: string): Promise<ProjectRevision[]> {
  const { data, error } = await requireSupabase()
    .from('project_revisions').select('*').eq('project_id', projectId)
    .order('requested_at', { ascending: false })
  throwDbError(error)
  return (data ?? []) as ProjectRevision[]
}

export async function createRevision(projectId: string, input: ProjectRevisionWrite): Promise<ProjectRevision> {
  const { data, error } = await requireSupabase()
    .from('project_revisions').insert({ project_id: projectId, ...revisionPayload(input) })
    .select('*').single()
  throwDbError(error)
  return revisionRow(data)
}

export async function updateRevision(id: string, input: ProjectRevisionWrite): Promise<ProjectRevision> {
  const { data, error } = await requireSupabase()
    .from('project_revisions').update(revisionPayload(input)).eq('id', id).select('*').single()
  throwDbError(error)
  return revisionRow(data)
}
```

`updateTask` never sends `completed_at`/`cancelled_at`; `updateRevision` never sends `completed_at`/`approved_at`. Os triggers do banco são a única fonte desses timestamps. A validação de prazo anterior ao início permanece na UI, e a constraint SQL continua como barreira final.

Após aplicar as migrations 0001–0008, execute `supabase/tests/etapa3_projects.sql` e `supabase/tests/etapa3_task_concurrency.sql` no SQL Editor. O primeiro prova a ordenação 0..N-1 e a rejeição de listas inválidas; o segundo confirma a advisory em duas conexões e exige `55P03` nos seis probes de INSERT, UPDATE e DELETE diretos contra reordenação, nunca `40P01`.

Run: `npm test -- src/services/projectTaskService.test.ts src/services/projectRevisionService.test.ts && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_etapa3_projects.sql supabase/tests/etapa3_projects.sql supabase/tests/etapa3_task_concurrency.sql src/services/projectTaskService.ts src/services/projectTaskService.test.ts src/services/projectRevisionService.ts src/services/projectRevisionService.test.ts
git commit -m "feat: adicionar servicos de tarefas e revisoes"
```

---

### Task 5: Criar `projectService` com métricas e formulário

**Files:**
- Create: `src/services/projectService.ts`
- Create: `src/services/projectService.test.ts`

**Interfaces:**
- Consumes: `Project`, `ProjectMoveStatus`, `ProjectDetail`, `ProjectListItem`, `ProjectFilters`, `ProjectSort`, `ProjectListResult`, `ProjectBoardResult`, `ProjectFormOptions`, `ProjectWrite`, `DeliveryInput`, `calculateProjectProgress`, money helpers.
- Produces:
  - `listProjects(filters, sort, page, pageSize = 24): Promise<ProjectListResult>`
  - `listProjectsForBoard(filters: ProjectFilters): Promise<ProjectBoardResult>`
  - `getProject(id): Promise<ProjectDetail | null>`
  - `createProject(input): Promise<Project>`, `updateProject(id,input): Promise<Project>`, `setProjectStatus(id,status: ProjectMoveStatus): Promise<Project>`, `deliverProject(id,input): Promise<Project>`
  - `listProjectFormOptions(): Promise<ProjectFormOptions>`

- [ ] **Step 1: Write failing service tests**

> Correção pós-revisão (2026-11-27): o bloco abaixo registra o baseline da task. A suíte canônica está em `src/services/projectService.test.ts` e deve preservar também as regressões de embed aninhado, paginação acima de 1000 linhas, chunks de 100 UUIDs, filtros do board, status de clientes, busca literal, `updateProject` e respostas RPC parciais.

```ts
// src/services/projectService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, requireSupabase: vi.fn(() => ({ rpc, from })) }
})

import {
  createProject, deliverProject, getProject, listProjectFormOptions, listProjects,
  listProjectsForBoard, setProjectStatus,
} from './projectService'

const projectRow = {
  id: 'project-1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site', service: 'Site', contracted_value: '1234.56', description: null,
  start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null, priority: 'high',
  status: 'not_started', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

function listQuery(rows: unknown[], count: number | null = rows.length) {
  const query = {
    select: vi.fn(), or: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(),
    order: vi.fn(), range: vi.fn(),
  }
  for (const method of [query.select, query.or, query.eq, query.gte, query.lte, query.order]) {
    method.mockReturnValue(query)
  }
  query.range.mockResolvedValue({ data: rows, count, error: null })
  return query
}

function tasksQuery(tasks: Array<{ project_id: string; status: string }>) {
  const query = { select: vi.fn(), in: vi.fn() }
  query.select.mockReturnValue(query)
  query.in.mockResolvedValue({ data: tasks, error: null })
  return query
}

describe('projectService', () => {
  beforeEach(() => {
    rpc.mockReset()
    from.mockReset()
  })

  it('converte centavos e envia projeto para a RPC', async () => {
    rpc.mockResolvedValue({ data: projectRow, error: null })
    const result = await createProject({
      clientId: 'client-1', contractId: 'contract-1', name: 'Site', service: 'Site',
      contractedValueCents: 123456, description: '', startDate: '2026-11-25',
      dueDate: '2026-12-10', responsibleName: '', priority: 'high',
    })
    expect(rpc).toHaveBeenCalledWith('create_project', {
      p_payload: {
        client_id: 'client-1', contract_id: 'contract-1', name: 'Site', service: 'Site',
        contracted_value: '1234.56', description: null, start_date: '2026-11-25',
        due_date: '2026-12-10', responsible_name: null, priority: 'high',
      },
    })
    expect(result).toMatchObject({ id: 'project-1', status: 'not_started', contracted_value_cents: 123456 })
  })

  it('entrega com confirmação explícita e não chama função financeira', async () => {
    rpc.mockResolvedValue({ data: { ...projectRow, status: 'delivered' }, error: null })
    await deliverProject('project-1', {
      deliveryUrl: 'https://example.test/site', filesUrl: '', finalNotes: 'Entregue', confirmed: true,
    })
    expect(rpc).toHaveBeenCalledWith('deliver_project', {
      p_project_id: 'project-1',
      p_payload: { delivery_url: 'https://example.test/site', files_url: null, final_notes: 'Entregue', confirmed: true },
    })
    expect(rpc).not.toHaveBeenCalledWith(expect.stringContaining('payment'), expect.anything())
  })

  it('listProjects attaches progress from one task query', async () => {
    const projects = listQuery([{ ...projectRow, contracts: { clients: [{ name: 'Empresa A' }] } }], 1)
    const tasks = tasksQuery([
      { project_id: 'project-1', status: 'completed' },
      { project_id: 'project-1', status: 'pending' },
    ])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    const result = await listProjects({}, 'created_desc', 0)
    expect(tasks.select).toHaveBeenCalledOnce()
    expect(tasks.in).toHaveBeenCalledWith('project_id', ['project-1'])
    expect(result.projects[0]).toMatchObject({
      client_name: 'Empresa A', contracted_value_cents: 123456,
      activeTasks: 2, completedTasks: 1, progressPercent: 50,
    })
  })

  it('listProjects returns total from Supabase count', async () => {
    const projects = listQuery([], 37)
    from.mockReturnValue(projects)
    const result = await listProjects({}, 'name_asc', 1, 24)
    expect(result).toEqual({ projects: [], total: 37 })
    expect(projects.range).toHaveBeenCalledWith(24, 47)
  })

  it('listProjects quotes search values in OR', async () => {
    const projects = listQuery([])
    from.mockReturnValue(projects)
    await listProjects({ search: 'Site, "Alpha"' }, 'name_asc', 0)
    const pattern = `name.ilike.${JSON.stringify('%Site, "Alpha"%')}`
    expect(projects.or).toHaveBeenCalledWith([
      pattern,
      pattern.replace('name.', 'service.'),
      pattern.replace('name.', 'description.'),
    ].join(','))
  })

  it('listProjectsForBoard marks 500 rows as partial', async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({ ...projectRow, id: `project-${index}` }))
    const projects = {
      select: vi.fn(), is: vi.fn(), neq: vi.fn(), or: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(),
      order: vi.fn(), limit: vi.fn(),
    }
    for (const method of [projects.select, projects.is, projects.neq, projects.or, projects.eq, projects.gte, projects.lte, projects.order]) {
      method.mockReturnValue(projects)
    }
    projects.limit.mockResolvedValue({ data: rows, error: null })
    const tasks = tasksQuery([])
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasks)
    const result = await listProjectsForBoard({})
    expect(projects.is).toHaveBeenCalledWith('archived_at', null)
    expect(projects.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(projects.limit).toHaveBeenCalledWith(500)
    expect(result.partial).toBe(true)
    expect(result.projects).toHaveLength(500)
  })

  it('listProjectsForBoard applies the same search, client, status, priority and deadline filters', async () => {
    const projects = {
      select: vi.fn(), is: vi.fn(), neq: vi.fn(), or: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(),
      order: vi.fn(), limit: vi.fn(),
    }
    for (const method of [projects.select, projects.is, projects.neq, projects.or, projects.eq, projects.gte, projects.lte, projects.order]) {
      method.mockReturnValue(projects)
    }
    projects.limit.mockResolvedValue({ data: [], error: null })
    from.mockImplementation((table: string) => table === 'projects' ? projects : tasksQuery([]))
    await listProjectsForBoard({
      search: 'Site, "Alpha"', clientId: 'client-1', status: 'in_development',
      priority: 'high', dueFrom: '2026-12-01', dueTo: '2026-12-31',
    })
    const pattern = `name.ilike.${JSON.stringify('%Site, "Alpha"%')}`
    expect(projects.or).toHaveBeenCalledWith([
      pattern, pattern.replace('name.', 'service.'), pattern.replace('name.', 'description.'),
    ].join(','))
    expect(projects.eq).toHaveBeenCalledWith('client_id', 'client-1')
    expect(projects.eq).toHaveBeenCalledWith('status', 'in_development')
    expect(projects.eq).toHaveBeenCalledWith('priority', 'high')
    expect(projects.gte).toHaveBeenCalledWith('due_date', '2026-12-01')
    expect(projects.lte).toHaveBeenCalledWith('due_date', '2026-12-31')
  })

  it('getProject returns null for missing project', async () => {
    const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
    const taskQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const revisionQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const activityQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    for (const query of [projectQuery, taskQuery, revisionQuery, activityQuery]) {
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
    }
    projectQuery.maybeSingle.mockResolvedValue({ data: null, error: null })
    taskQuery.order.mockReturnValueOnce(taskQuery).mockResolvedValueOnce({ data: [], error: null })
    revisionQuery.order.mockResolvedValue({ data: [], error: null })
    activityQuery.order.mockResolvedValue({ data: [], error: null })
    from.mockImplementation((table: string) => {
      switch (table) {
        case 'projects': return projectQuery
        case 'project_tasks': return taskQuery
        case 'project_revisions': return revisionQuery
        case 'client_activities': return activityQuery
        default: throw new Error(`Tabela inesperada: ${table}`)
      }
    })
    await expect(getProject('missing')).resolves.toBeNull()
  })

  it('getProject loads tasks revisions and activities in parallel', async () => {
    const projectResult = deferred<unknown>()
    const tasksResult = deferred<unknown>()
    const revisionsResult = deferred<unknown>()
    const activitiesResult = deferred<unknown>()
    const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }
    const taskQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const revisionQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    const activityQuery = { select: vi.fn(), eq: vi.fn(), order: vi.fn() }
    for (const query of [projectQuery, taskQuery, revisionQuery, activityQuery]) {
      query.select.mockReturnValue(query)
      query.eq.mockReturnValue(query)
    }
    projectQuery.maybeSingle.mockReturnValue(projectResult.promise)
    taskQuery.order.mockReturnValueOnce(taskQuery).mockReturnValueOnce(tasksResult.promise)
    revisionQuery.order.mockReturnValue(revisionsResult.promise)
    activityQuery.order.mockReturnValue(activitiesResult.promise)
    from.mockImplementation((table: string) => {
      switch (table) {
        case 'projects': return projectQuery
        case 'project_tasks': return taskQuery
        case 'project_revisions': return revisionQuery
        case 'client_activities': return activityQuery
        default: throw new Error(`Tabela inesperada: ${table}`)
      }
    })

    const pending = getProject('project-1')
    expect(projectQuery.maybeSingle).toHaveBeenCalledOnce()
    expect(taskQuery.order).toHaveBeenCalledTimes(2)
    expect(revisionQuery.order).toHaveBeenCalledOnce()
    expect(activityQuery.order).toHaveBeenCalledOnce()
    projectResult.resolve({ data: { ...projectRow, contracts: { clients: { name: 'Empresa A' } } }, error: null })
    tasksResult.resolve({ data: [], error: null })
    revisionsResult.resolve({ data: [], error: null })
    activitiesResult.resolve({ data: [], error: null })
    await expect(pending).resolves.toMatchObject({
      id: 'project-1', client_name: 'Empresa A', tasks: [], revisions: [], activities: [],
    })
  })

  it('setProjectStatus sends only project id and status', async () => {
    rpc.mockResolvedValue({ data: { ...projectRow, status: 'in_review' }, error: null })
    await setProjectStatus('project-1', 'in_review')
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('set_project_status', {
      p_project_id: 'project-1', p_status: 'in_review',
    })
  })

  it('listProjectFormOptions excludes only inactive clients and cancelled contracts and returns real balances', async () => {
    const clientsQuery = {
      select: vi.fn(), neq: vi.fn(), order: vi.fn(),
    }
    const contractsQuery = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    }
    const projectsQuery = {
      select: vi.fn(), neq: vi.fn(), order: vi.fn(),
    }
    for (const query of [clientsQuery, contractsQuery, projectsQuery]) {
      query.select.mockReturnValue(query)
      query.order.mockResolvedValue({ data: [], error: null })
    }
    clientsQuery.neq.mockReturnValue(clientsQuery)
    contractsQuery.eq.mockReturnValue(contractsQuery)
    projectsQuery.neq.mockReturnValue(projectsQuery)
    clientsQuery.order.mockResolvedValue({
      data: [
        { id: 'client-1', name: 'Cliente Ativo', status: 'active' },
        { id: 'client-2', name: 'Cliente Em Projeto', status: 'in_project' },
        { id: 'client-3', name: 'Aguardando Pagamento', status: 'awaiting_payment' },
        { id: 'client-4', name: 'Aguardando Aprovação', status: 'awaiting_approval' },
        { id: 'client-5', name: 'Projeto Concluído', status: 'project_completed' },
        { id: 'client-6', name: 'Cliente Arquivado', status: 'inactive', archived_at: '2026-11-01T00:00:00Z' },
      ],
      error: null,
    })
    contractsQuery.order.mockResolvedValue({
      data: [
        { id: 'contract-1', client_id: 'client-1', service: 'Site', total_value: '1000.00', due_date: '2026-12-31', status: 'active' },
        { id: 'contract-2', client_id: 'client-1', service: 'Cancelado', total_value: '100.00', due_date: null, status: 'cancelled' },
      ],
      error: null,
    })
    projectsQuery.order.mockResolvedValue({
      data: [
        { contract_id: 'contract-1', contracted_value: '300.00', status: 'in_development' },
        { contract_id: 'contract-1', contracted_value: '200.00', status: 'completed' },
        { contract_id: 'contract-1', contracted_value: '900.00', status: 'cancelled' },
      ],
      error: null,
    })
    from.mockImplementation((table: string) => {
      if (table === 'clients') return clientsQuery
      if (table === 'contracts') return contractsQuery
      if (table === 'projects') return projectsQuery
      throw new Error(`Tabela inesperada: ${table}`)
    })

    const result = await listProjectFormOptions()

    expect(clientsQuery.neq).toHaveBeenCalledWith('status', 'inactive')
    expect(contractsQuery.eq).toHaveBeenCalledWith('status', 'active')
    expect(projectsQuery.neq).toHaveBeenCalledWith('status', 'cancelled')
    expect(result).toEqual({
      clients: [
        { id: 'client-1', name: 'Cliente Ativo' },
        { id: 'client-2', name: 'Cliente Em Projeto' },
        { id: 'client-3', name: 'Aguardando Pagamento' },
        { id: 'client-4', name: 'Aguardando Aprovação' },
        { id: 'client-5', name: 'Projeto Concluído' },
      ],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 50000, remaining_cents: 50000, due_date: '2026-12-31',
      }],
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/projectService.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the service**

```ts
// src/services/projectService.ts
import { requireSupabase, throwDbError } from '../lib/db'
import { fromMoneyDecimal, sumMoney, toMoneyDecimal } from '../lib/money'
import { calculateProjectProgress } from '../lib/projectProgress'
import type { ClientActivity } from '../types/client'
import type {
  DeliveryInput, Project, ProjectBoardResult, ProjectDetail, ProjectFilters,
  ProjectFormClientOption, ProjectFormContractOption, ProjectFormOptions,
  ProjectListItem, ProjectListResult, ProjectMetrics, ProjectMoveStatus,
  ProjectRevision, ProjectSort, ProjectTask, ProjectWrite,
} from '../types/project'

type Embedded<T> = T | T[] | null
type ProjectRow = Omit<Project, 'contracted_value_cents'> & {
  contracted_value: string | number
  contracts?: Embedded<{ clients?: Embedded<{ name: string }> }>
}
type ProjectBase = Omit<ProjectListItem, keyof ProjectMetrics>
type ProjectTaskMetrics = Pick<ProjectTask, 'project_id' | 'status'>

interface ProjectFilterQuery {
  or(filters: string): this
  eq(column: string, value: unknown): this
  gte(column: string, value: unknown): this
  lte(column: string, value: unknown): this
}

const PAGE_SIZE = 1000
const ID_CHUNK_SIZE = 100
const REQUIRED_PROJECT_FIELDS = [
  'id', 'owner_id', 'client_id', 'contract_id', 'source_link_id', 'name', 'service',
  'contracted_value', 'description', 'start_date', 'due_date', 'responsible_name',
  'priority', 'status', 'completed_at', 'delivered_at', 'delivery_confirmed_at',
  'delivery_url', 'files_url', 'final_notes', 'archived_at', 'created_at', 'updated_at',
] as const

const SORTS: Record<ProjectSort, { column: string; ascending: boolean; nullsFirst?: boolean }> = {
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  due_asc: { column: 'due_date', ascending: true, nullsFirst: false },
  due_desc: { column: 'due_date', ascending: false, nullsFirst: false },
  created_desc: { column: 'created_at', ascending: false },
}

function nullable(value: string): string | null {
  return value.trim() ? value.trim() : null
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    throwDbError(error)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function moneyCents(value: string | number): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) {
    throw new Error('Valor monetário inválido recebido do banco.')
  }
  return fromMoneyDecimal(value)
}

function firstRelation<T>(value: Embedded<T> | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

function projectBase(row: ProjectRow): ProjectBase {
  const { contracted_value, contracts, ...project } = row
  const client = firstRelation(firstRelation(contracts)?.clients)
  return {
    ...project,
    contracted_value_cents: moneyCents(contracted_value),
    client_name: client?.name ?? null,
  }
}

function projectFromRow(row: ProjectRow): Project {
  return projectBase(row)
}

function rpcProject(data: unknown): Project {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Resposta inválida ao salvar projeto.')
  }
  const candidate = data as Record<string, unknown>
  if (typeof candidate.id !== 'string' || REQUIRED_PROJECT_FIELDS.some(
    (field) => !(field in candidate) || candidate[field] === undefined,
  )) {
    throw new Error('Resposta inválida ao salvar projeto.')
  }
  return projectFromRow(data as ProjectRow)
}

function projectPayload(input: ProjectWrite) {
  return {
    client_id: input.clientId,
    contract_id: input.contractId,
    name: input.name,
    service: input.service,
    contracted_value: toMoneyDecimal(input.contractedValueCents),
    description: nullable(input.description),
    start_date: input.startDate,
    due_date: input.dueDate,
    responsible_name: nullable(input.responsibleName),
    priority: input.priority,
  }
}

function applyProjectFilters<T extends ProjectFilterQuery>(query: T, filters: ProjectFilters): T {
  const search = filters.search?.trim()
  if (search) {
    const literal = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    const pattern = JSON.stringify(`%${literal}%`)
    query = query.or(['name', 'service', 'description']
      .map((column) => `${column}.ilike.${pattern}`).join(','))
  }
  if (filters.clientId) query = query.eq('client_id', filters.clientId)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.dueFrom) query = query.gte('due_date', filters.dueFrom)
  if (filters.dueTo) query = query.lte('due_date', filters.dueTo)
  return query
}

async function tasksByProject(projectIds: string[]): Promise<Map<string, ProjectTaskMetrics[]>> {
  const grouped = new Map<string, ProjectTaskMetrics[]>()
  if (projectIds.length === 0) return grouped
  const client = requireSupabase()
  for (let index = 0; index < projectIds.length; index += ID_CHUNK_SIZE) {
    const projectIdChunk = projectIds.slice(index, index + ID_CHUNK_SIZE)
    const tasks = await fetchAllPages<ProjectTaskMetrics>((from, to) => client
      .from('project_tasks').select('project_id,status')
      .in('project_id', projectIdChunk)
      .order('project_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to))
    for (const task of tasks) {
      const current = grouped.get(task.project_id) ?? []
      current.push(task)
      grouped.set(task.project_id, current)
    }
  }
  return grouped
}

async function attachMetrics(rows: ProjectRow[]): Promise<ProjectListItem[]> {
  const grouped = await tasksByProject(rows.map((row) => row.id))
  return rows.map((row) => ({
    ...projectBase(row),
    ...calculateProjectProgress((grouped.get(row.id) ?? []) as ProjectTask[]),
  }))
}

export async function listProjects(
  filters: ProjectFilters,
  sort: ProjectSort,
  page: number,
  pageSize = 24,
): Promise<ProjectListResult> {
  let query = requireSupabase().from('projects').select('*, contracts(clients(name))', { count: 'exact' })
  query = applyProjectFilters(query, filters)

  const order = SORTS[sort]
  const from = page * pageSize
  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)
  throwDbError(error)
  return { projects: await attachMetrics((data ?? []) as ProjectRow[]), total: count ?? 0 }
}

export async function listProjectsForBoard(filters: ProjectFilters = {}): Promise<ProjectBoardResult> {
  let query = requireSupabase()
    .from('projects').select('*, contracts(clients(name))')
    .is('archived_at', null).neq('status', 'cancelled')
  query = applyProjectFilters(query, filters)
  const { data, error } = await query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(500)
  throwDbError(error)
  const projects = await attachMetrics((data ?? []) as ProjectRow[])
  return { projects, partial: projects.length === 500 }
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const client = requireSupabase()
  const [projectResult, tasks, revisions, activities] = await Promise.all([
    client.from('projects').select('*, contracts(clients(name))').eq('id', id).maybeSingle(),
    fetchAllPages<ProjectTask>((from, to) => client.from('project_tasks').select('*')
      .eq('project_id', id).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<ProjectRevision>((from, to) => client.from('project_revisions').select('*')
      .eq('project_id', id).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<ClientActivity>((from, to) => client.from('client_activities').select('*')
      .eq('project_id', id).order('id', { ascending: true }).range(from, to)),
  ])
  throwDbError(projectResult.error)
  if (!projectResult.data) return null
  tasks.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
  revisions.sort((a, b) => b.requested_at.localeCompare(a.requested_at) || a.id.localeCompare(b.id))
  activities.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id))
  return {
    ...projectBase(projectResult.data as ProjectRow),
    ...calculateProjectProgress(tasks),
    tasks,
    revisions,
    activities,
  }
}

export async function createProject(input: ProjectWrite): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('create_project', { p_payload: projectPayload(input) })
  throwDbError(error)
  return rpcProject(data)
}

export async function updateProject(id: string, input: ProjectWrite): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('update_project', { p_project_id: id, p_payload: projectPayload(input) })
  throwDbError(error)
  return rpcProject(data)
}

export async function setProjectStatus(id: string, status: ProjectMoveStatus): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('set_project_status', { p_project_id: id, p_status: status })
  throwDbError(error)
  return rpcProject(data)
}

export async function deliverProject(id: string, input: DeliveryInput): Promise<Project> {
  const { data, error } = await requireSupabase().rpc('deliver_project', {
    p_project_id: id,
    p_payload: {
      delivery_url: input.deliveryUrl,
      files_url: nullable(input.filesUrl),
      final_notes: nullable(input.finalNotes),
      confirmed: input.confirmed,
    },
  })
  throwDbError(error)
  return rpcProject(data)
}

export async function listProjectFormOptions(): Promise<ProjectFormOptions> {
  const client = requireSupabase()
  const [clientRows, contractRows, projectRows] = await Promise.all([
    fetchAllPages<{ id: string; name: string; status: string }>((from, to) => client
      .from('clients').select('id,name,status').neq('status', 'inactive')
      .order('name', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<{
      id: string; client_id: string; service: string; total_value: string | number
      due_date: string | null; status: string
    }>((from, to) => client.from('contracts').select('id,client_id,service,total_value,due_date,status')
      .eq('status', 'active')
      .order('service', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    fetchAllPages<{ id: string; contract_id: string; contracted_value: string | number; status: string }>(
      (from, to) => client.from('projects').select('id,contract_id,contracted_value,status')
        .neq('status', 'cancelled').order('id', { ascending: true }).range(from, to),
    ),
  ])

  const clients = clientRows.map(({ id, name }): ProjectFormClientOption => ({ id, name }))
  const allocated = new Map<string, number>()
  for (const row of projectRows) {
    if (row.status === 'cancelled') continue
    allocated.set(row.contract_id, sumMoney(allocated.get(row.contract_id) ?? 0, moneyCents(row.contracted_value)))
  }
  const contracts = contractRows
    .filter((row) => row.status === 'active')
    .map((row): ProjectFormContractOption => {
      const totalValueCents = moneyCents(row.total_value)
      const allocatedCents = allocated.get(row.id) ?? 0
      return {
        id: row.id, client_id: row.client_id, service: row.service,
        total_value_cents: totalValueCents, allocated_cents: allocatedCents,
        remaining_cents: totalValueCents - allocatedCents, due_date: row.due_date,
      }
    })
  return { clients, contracts }
}
```

A busca escapa `\`, `%` e `_` antes do JSON quoting no `.or`, preservando vírgulas, dois-pontos e aspas sem transformar o termo em curinga. `maybeSingle()` diferencia projeto ausente de falha real. Nenhuma resposta RPC vazia ou parcial vira objeto incompleto, e métricas só são anexadas após consultar tarefas reais. Todas as coleções completas são paginadas em blocos de 1000 linhas; os IDs do board usam chunks de no máximo 100 UUIDs para evitar URLs longos, mantendo a coleta bulk sem N+1 por projeto.

Run: `npm test -- src/services/projectService.test.ts && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/services/projectService.ts src/services/projectService.test.ts
git commit -m "feat: adicionar servico de projetos"
```

---

### Task 6: Criar fila de mutação do Kanban de projetos

**Files:**
- Create: `src/hooks/useProjectStatusQueue.ts`
- Create: `src/hooks/useProjectStatusQueue.test.tsx`

**Interfaces:**
- Consumes: `setProjectStatus`, `Project`, `ProjectListItem`, `ProjectMoveStatus`.
- Produces:

```ts
export function useProjectStatusQueue(options: {
  projects: ProjectListItem[]
  onChange: (projects: ProjectListItem[]) => void
  onRefresh: () => Promise<void>
}): {
  projects: ProjectListItem[]
  pendingIds: ReadonlySet<string>
  moveProject: (id: string, status: ProjectMoveStatus) => Promise<void>
  requestRefresh: () => Promise<void>
}
```

- [ ] **Step 1: Write failing concurrency tests**

```tsx
// @vitest-environment jsdom
// src/hooks/useProjectStatusQueue.test.tsx
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectListItem } from '../types/project'

const { setProjectStatus } = vi.hoisted(() => ({ setProjectStatus: vi.fn() }))
vi.mock('../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectService')>()
  return { ...actual, setProjectStatus }
})

import { useProjectStatusQueue } from './useProjectStatusQueue'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Projeto', client_name: 'Cliente', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: null, due_date: null, responsible_name: null, priority: 'high',
  status: 'not_started', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: null, activeTasks: 0, completedTasks: 0,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

afterEach(cleanup)

describe('useProjectStatusQueue', () => {
  beforeEach(() => { setProjectStatus.mockReset() })

  it('serializa movimentos do mesmo projeto e preserva a última resposta', async () => {
    const first = deferred<Project>()
    const second = deferred<Project>()
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const onChange = vi.fn()
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange, onRefresh: vi.fn(),
    }))

    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p1', 'in_development')
    })
    expect(setProjectStatus).toHaveBeenCalledTimes(1)
    expect(result.current.projects[0].status).toBe('in_development')
    expect(result.current.pendingIds.has('p1')).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'p1', status: 'in_development' }),
    ])

    await act(async () => {
      first.resolve({ ...project, status: 'planning' })
      await firstMove
    })
    expect(result.current.projects[0].status).toBe('in_development')
    expect(result.current.pendingIds.has('p1')).toBe(true)
    await act(async () => {
      second.resolve({ ...project, status: 'in_development' })
      await secondMove
    })
    expect(result.current.projects[0].status).toBe('in_development')
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('faz rollback somente se o card ainda está no status otimista que falhou', async () => {
    setProjectStatus.mockRejectedValue(new Error('Falha'))
    const onChange = vi.fn()
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange, onRefresh: vi.fn(),
    }))
    await act(async () => {
      await result.current.moveProject('p1', 'planning').catch(() => undefined)
    })
    expect(result.current.projects[0].status).toBe('not_started')
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('não desfaz uma intenção mais nova quando a movimentação anterior falha', async () => {
    const first = deferred<Project>()
    const second = deferred<Project>()
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: vi.fn(),
    }))
    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p1', 'in_development')
    })
    await act(async () => {
      first.reject(new Error('Falha na primeira'))
      await firstMove.catch(() => undefined)
    })
    expect(result.current.projects[0].status).toBe('in_development')
    await act(async () => {
      second.resolve({ ...project, status: 'in_development' })
      await secondMove
    })
    expect(result.current.projects[0].status).toBe('in_development')
  })

  it('adia refresh solicitado durante uma mutação', async () => {
    const pending = deferred<Project>()
    const refresh = vi.fn().mockResolvedValue(undefined)
    setProjectStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))
    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    await act(async () => { await result.current.requestRefresh() })
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => {
      pending.resolve({ ...project, status: 'planning' })
      await move
    })
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('isola rejeição do refresh adiado após RPC bem-sucedida', async () => {
    const refreshError = new Error('Falha no refresh')
    const refresh = vi.fn().mockRejectedValue(refreshError)
    setProjectStatus.mockResolvedValue({ ...project, status: 'planning' })
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))

    let move!: Promise<void>
    act(() => {
      move = result.current.moveProject('p1', 'planning')
      void result.current.requestRefresh()
    })
    await act(async () => {
      await expect(move).resolves.toBeUndefined()
    })
    expect(result.current.projects[0].status).toBe('planning')
    expect(result.current.pendingIds.size).toBe(0)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('preserva o erro da RPC quando o refresh adiado também rejeita', async () => {
    const pending = deferred<Project>()
    const rpcError = new Error('Falha na movimentação')
    const refreshError = new Error('Falha no refresh')
    const refresh = vi.fn().mockRejectedValue(refreshError)
    setProjectStatus.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))

    let move!: Promise<void>
    act(() => {
      move = result.current.moveProject('p1', 'planning')
      void result.current.requestRefresh()
    })
    await act(async () => {
      pending.reject(rpcError)
      await expect(move).rejects.toBe(rpcError)
    })
    expect(result.current.projects[0].status).toBe('not_started')
    expect(result.current.pendingIds.size).toBe(0)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('propaga rejeição de refresh imediato sem mutações pendentes', async () => {
    const refreshError = new Error('Falha no refresh')
    const refresh = vi.fn().mockRejectedValue(refreshError)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: refresh,
    }))

    await act(async () => {
      await expect(result.current.requestRefresh()).rejects.toBe(refreshError)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('preserva métricas e client_name ao mesclar o Project retornado pelo RPC sem relação', async () => {
    const { client_name: _clientName, progressPercent: _progressPercent, activeTasks: _activeTasks, completedTasks: _completedTasks, ...projectWithoutBoardFields } = project
    setProjectStatus.mockResolvedValue({ ...projectWithoutBoardFields, status: 'planning' })
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: vi.fn(),
    }))
    await act(async () => { await result.current.moveProject('p1', 'planning') })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      status: 'planning', progressPercent: null, activeTasks: 0,
      completedTasks: 0, client_name: 'Cliente',
    }))
  })

  it('usa o baseline confirmado quando a segunda intenção falha', async () => {
    const first = deferred<Project>()
    const second = deferred<Project>()
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project], onChange: vi.fn(), onRefresh: vi.fn(),
    }))
    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p1', 'in_development')
    })
    await act(async () => {
      first.resolve({ ...project, status: 'planning' })
      await firstMove
    })
    await act(async () => {
      second.reject(new Error('Falha na segunda'))
      await secondMove.catch(() => undefined)
    })
    expect(result.current.projects[0].status).toBe('planning')
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('executa projetos diferentes em paralelo e adia o refresh até ambos terminarem', async () => {
    const other: ProjectListItem = { ...project, id: 'p2', name: 'Outro projeto' }
    const first = deferred<Project>()
    const second = deferred<Project>()
    const refresh = vi.fn().mockResolvedValue(undefined)
    setProjectStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useProjectStatusQueue({
      projects: [project, other], onChange: vi.fn(), onRefresh: refresh,
    }))
    let firstMove!: Promise<void>
    let secondMove!: Promise<void>
    act(() => {
      firstMove = result.current.moveProject('p1', 'planning')
      secondMove = result.current.moveProject('p2', 'planning')
      void result.current.requestRefresh()
    })
    expect(setProjectStatus).toHaveBeenCalledTimes(2)
    expect(result.current.pendingIds).toEqual(new Set(['p1', 'p2']))
    await act(async () => {
      first.resolve({ ...project, status: 'planning' })
      await firstMove
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(result.current.pendingIds.has('p1')).toBe(false)
    expect(result.current.pendingIds.has('p2')).toBe(true)
    await act(async () => {
      second.resolve({ ...other, status: 'planning' })
      await secondMove
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result.current.pendingIds.size).toBe(0)
  })

  it('reconcilia snapshots externos por projeto sem novo rerender nem onChange', async () => {
    const pending = deferred<Project>()
    const other: ProjectListItem = { ...project, id: 'p2', name: 'Outro projeto' }
    const onChange = vi.fn()
    setProjectStatus.mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange, onRefresh: vi.fn() }),
      { initialProps: { projects: [project, other] } },
    )

    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    expect(onChange).toHaveBeenCalledTimes(1)

    const external: ProjectListItem = {
      ...project,
      name: 'Nome externo',
      description: 'Descrição externa',
      updated_at: '2026-11-26T10:00:00Z',
    }
    const externalOther: ProjectListItem = {
      ...other,
      name: 'Outro externo',
      status: 'in_development',
    }
    rerender({ projects: [external, externalOther] })
    expect(result.current.projects).toEqual([
      expect.objectContaining({ id: 'p1', name: 'Projeto', description: null, status: 'planning' }),
      expect.objectContaining({ id: 'p2', name: 'Outro externo', status: 'in_development' }),
    ])
    expect(onChange).toHaveBeenCalledTimes(1)

    const latestExternal = { ...external, name: 'Nome mais recente' }
    const latestExternalOther = { ...externalOther, name: 'Outro mais recente' }
    rerender({ projects: [latestExternal, latestExternalOther] })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Projeto', status: 'planning',
    }))
    expect(result.current.projects[1]).toEqual(expect.objectContaining({
      id: 'p2', name: 'Outro mais recente', status: 'in_development',
    }))
    expect(onChange).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ ...project, status: 'planning' })
      await move
    })
    expect(result.current.projects).toEqual([
      expect.objectContaining({
        id: 'p1', name: 'Nome mais recente', description: 'Descrição externa',
        updated_at: '2026-11-26T10:00:00Z', status: 'planning',
      }),
      expect.objectContaining({ id: 'p2', name: 'Outro mais recente', status: 'in_development' }),
    ])
    expect(result.current.pendingIds.size).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('reconcilia campos externos preservando o rollback quando a mutação falha', async () => {
    const pending = deferred<Project>()
    const onChange = vi.fn()
    setProjectStatus.mockReturnValue(pending.promise)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange, onRefresh: vi.fn() }),
      { initialProps: { projects: [project] } },
    )

    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    const external: ProjectListItem = {
      ...project,
      name: 'Nome externo',
      description: 'Descrição externa',
      status: 'delivered',
      updated_at: '2026-11-26T10:00:00Z',
    }
    rerender({ projects: [external] })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Projeto', description: null, status: 'planning',
    }))
    expect(onChange).toHaveBeenCalledTimes(1)

    const rpcError = new Error('Falha na movimentação')
    await act(async () => {
      pending.reject(rpcError)
      await expect(move).rejects.toBe(rpcError)
    })
    expect(result.current.projects[0]).toEqual(expect.objectContaining({
      id: 'p1', name: 'Nome externo', description: 'Descrição externa',
      updated_at: '2026-11-26T10:00:00Z', status: 'not_started',
    }))
    expect(result.current.pendingIds.size).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('sincroniza dados externos sem pendências e não sobrescreve uma intenção pendente', async () => {
    const pending = deferred<Project>()
    setProjectStatus.mockReturnValue(pending.promise)
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ projects }) => useProjectStatusQueue({ projects, onChange: vi.fn(), onRefresh }),
      { initialProps: { projects: [project] } },
    )
    let move!: Promise<void>
    act(() => { move = result.current.moveProject('p1', 'planning') })
    const external: ProjectListItem = { ...project, name: 'Nome externo', status: 'not_started' }
    rerender({ projects: [external] })
    expect(result.current.projects[0].name).toBe('Projeto')
    expect(result.current.projects[0].status).toBe('planning')
    await act(async () => {
      pending.resolve({ ...project, status: 'planning' })
      await move
    })
    rerender({ projects: [{ ...external, status: 'planning', updated_at: '2026-11-26T10:00:00Z' }] })
    expect(result.current.projects[0].status).toBe('planning')
    expect(result.current.projects[0].updated_at).toBe('2026-11-26T10:00:00Z')
  })

  it('usa o callback de refresh mais recente sem pendências e ignora no-op e entregue', async () => {
    const firstRefresh = vi.fn().mockResolvedValue(undefined)
    const latestRefresh = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ projects, onRefresh }) => useProjectStatusQueue({ projects, onChange: vi.fn(), onRefresh }),
      { initialProps: { projects: [project], onRefresh: firstRefresh } },
    )
    rerender({ projects: [project], onRefresh: latestRefresh })
    await act(async () => { await result.current.requestRefresh() })
    expect(latestRefresh).toHaveBeenCalledTimes(1)
    expect(firstRefresh).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.moveProject('p1', 'not_started')
      await result.current.moveProject('inexistente', 'planning')
    })
    expect(setProjectStatus).not.toHaveBeenCalled()
    rerender({ projects: [{ ...project, status: 'delivered' }], onRefresh: latestRefresh })
    await act(async () => { await result.current.moveProject('p1', 'planning') })
    expect(setProjectStatus).not.toHaveBeenCalled()
    expect(result.current.projects[0].status).toBe('delivered')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/hooks/useProjectStatusQueue.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useProjectStatusQueue.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { setProjectStatus } from '../services/projectService'
import type { ProjectListItem, ProjectMoveStatus } from '../types/project'

export interface UseProjectStatusQueueOptions {
  projects: ProjectListItem[]
  onChange: (projects: ProjectListItem[]) => void
  onRefresh: () => Promise<void>
}

export interface UseProjectStatusQueueResult {
  projects: ProjectListItem[]
  pendingIds: ReadonlySet<string>
  moveProject: (id: string, status: ProjectMoveStatus) => Promise<void>
  requestRefresh: () => Promise<void>
}

function sameProjectReferences(
  current: ProjectListItem[],
  incoming: ProjectListItem[],
): boolean {
  return current.length === incoming.length
    && current.every((project, index) => project === incoming[index])
}

export function useProjectStatusQueue(
  options: UseProjectStatusQueueOptions,
): UseProjectStatusQueueResult {
  const [projects, setProjects] = useState(options.projects)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set())
  const projectsRef = useRef(options.projects)
  const onChangeRef = useRef(options.onChange)
  const onRefreshRef = useRef(options.onRefresh)
  const pendingMovesRef = useRef(0)
  const pendingCountsRef = useRef(new Map<string, number>())
  const mutationVersionRef = useRef(0)
  const latestIntentVersionRef = useRef(new Map<string, number>())
  const confirmedStatusRef = useRef(new Map<string, ProjectListItem['status']>())
  const queuesRef = useRef(new Map<string, Promise<void>>())
  const refreshAfterMovesRef = useRef(false)
  const pendingExternalProjectsRef = useRef(new Map<string, ProjectListItem>())
  const mountedRef = useRef(true)
  const lastExternalProjectsRef = useRef(options.projects)

  const updateProjects = useCallback((updater: (current: ProjectListItem[]) => ProjectListItem[]) => {
    const next = updater(projectsRef.current)
    projectsRef.current = next
    if (!mountedRef.current) return
    setProjects(next)
    onChangeRef.current(next)
  }, [])

  const syncPendingIds = useCallback(() => {
    if (!mountedRef.current) return
    setPendingIds(new Set(pendingCountsRef.current.keys()))
  }, [])

  const reconcileExternalProject = useCallback((id: string) => {
    const external = pendingExternalProjectsRef.current.get(id)
    if (!external) return
    pendingExternalProjectsRef.current.delete(id)

    const current = projectsRef.current.find((project) => project.id === id)
    if (!current) return
    const status = confirmedStatusRef.current.get(id) ?? current.status
    const next = projectsRef.current.map((project) => (
      project.id === id ? { ...external, status } : project
    ))
    projectsRef.current = next
    if (!mountedRef.current) return
    setProjects(next)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    for (const project of projectsRef.current) {
      if (!confirmedStatusRef.current.has(project.id)) {
        confirmedStatusRef.current.set(project.id, project.status)
      }
    }
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    onChangeRef.current = options.onChange
    onRefreshRef.current = options.onRefresh

    const incoming = options.projects
    if (sameProjectReferences(lastExternalProjectsRef.current, incoming)) {
      lastExternalProjectsRef.current = incoming
      return
    }
    lastExternalProjectsRef.current = incoming

    const next = incoming.map((incomingProject) => {
      if (!pendingCountsRef.current.has(incomingProject.id)) {
        confirmedStatusRef.current.set(incomingProject.id, incomingProject.status)
        return incomingProject
      }

      pendingExternalProjectsRef.current.set(incomingProject.id, incomingProject)
      return projectsRef.current.find((project) => project.id === incomingProject.id)
        ?? incomingProject
    })
    projectsRef.current = next
    if (!mountedRef.current) return
    setProjects(next)
  }, [options.projects, options.onChange, options.onRefresh])

  const moveProject = useCallback((id: string, status: ProjectMoveStatus): Promise<void> => {
    const current = projectsRef.current.find((project) => project.id === id)
    if (!current || current.status === status || current.status === 'delivered') {
      return Promise.resolve()
    }

    const version = ++mutationVersionRef.current
    latestIntentVersionRef.current.set(id, version)
    pendingMovesRef.current += 1
    pendingCountsRef.current.set(id, (pendingCountsRef.current.get(id) ?? 0) + 1)
    if (!confirmedStatusRef.current.has(id)) {
      confirmedStatusRef.current.set(id, current.status)
    }
    syncPendingIds()
    updateProjects((items) => items.map((project) => (
      project.id === id ? { ...project, status } : project
    )))

    const run = async () => {
      try {
        const updated = await setProjectStatus(id, status)
        confirmedStatusRef.current.set(id, updated.status)
        mutationVersionRef.current += 1
        if (latestIntentVersionRef.current.get(id) === version) {
          updateProjects((items) => items.map((project) => (
            project.id === id ? { ...project, ...updated, client_name: project.client_name } : project
          )))
        }
      } catch (error) {
        mutationVersionRef.current += 1
        if (latestIntentVersionRef.current.get(id) === version) {
          const fallback = confirmedStatusRef.current.get(id) ?? current.status
          updateProjects((items) => items.map((project) => (
            project.id === id && project.status === status
              ? { ...project, status: fallback }
              : project
          )))
        }
        throw error
      } finally {
        pendingMovesRef.current -= 1
        const remaining = pendingCountsRef.current.get(id) ?? 1
        if (remaining <= 1) {
          pendingCountsRef.current.delete(id)
          reconcileExternalProject(id)
        } else {
          pendingCountsRef.current.set(id, remaining - 1)
        }
        syncPendingIds()
        if (pendingMovesRef.current === 0 && refreshAfterMovesRef.current) {
          refreshAfterMovesRef.current = false
          void onRefreshRef.current().catch(() => undefined)
        }
      }
    }

    const pending = queuesRef.current.get(id)
    const task = pending ? pending.then(run, run) : run()
    queuesRef.current.set(id, task)
    const cleanup = () => {
      if (queuesRef.current.get(id) === task) queuesRef.current.delete(id)
    }
    void task.then(cleanup, cleanup)
    return task
  }, [reconcileExternalProject, syncPendingIds, updateProjects])

  const requestRefresh = useCallback(async (): Promise<void> => {
    if (pendingMovesRef.current > 0) {
      refreshAfterMovesRef.current = true
      return
    }
    await onRefreshRef.current()
  }, [])

  return { projects, pendingIds, moveProject, requestRefresh }
}
```

A sincronização externa compara as referências dos itens: um array novo contendo os mesmos objetos não desfaz uma atualização local. Projetos sem intenção pendente são atualizados imediatamente; para cada projeto pendente, o snapshot externo mais recente é retido e reconciliado ao terminar sua última mutação, preservando o status confirmado ou de rollback e aplicando os demais campos sem chamar `onChange`. `moveProject` executa toda a intenção antes de chamar a RPC; somente `run` entra na fila por ID. O refresh adiado é disparado uma vez após todas as mutações e tem sua rejeição isolada, enquanto `requestRefresh()` imediato continua propagando a rejeição.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/hooks/useProjectStatusQueue.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProjectStatusQueue.ts src/hooks/useProjectStatusQueue.test.tsx
git commit -m "feat: adicionar fila de movimentacao de projetos"
```

---

### Task 7: Criar formulário e página de novo projeto

**Files:**
- Create: `src/components/projects/ProjectForm.tsx`
- Create: `src/components/projects/ProjectForm.test.tsx`
- Create: `src/pages/ProjectNewPage.tsx`

**Interfaces:**
- Consumes: `listProjectFormOptions(): Promise<ProjectFormOptions>`, `createProject(input: ProjectWrite): Promise<Project>`, `updateProject(id, input): Promise<Project>`, `suggestProjectDueDate`, `parseMoneyInput`, `formatMoney`.
- Produces: `ProjectFormProps`, `ProjectForm`, `ProjectNewPage`.

```ts
export interface ProjectFormProps {
  project?: ProjectListItem
  onCancel: () => void
  onSaved: (project: Project) => void
}
```

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
// src/components/projects/ProjectForm.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectListItem } from '../../types/project'

const { listProjectFormOptions, createProject, updateProject } = vi.hoisted(() => ({
  listProjectFormOptions: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectService')>()
  return { ...actual, listProjectFormOptions, createProject, updateProject }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectForm } from './ProjectForm'

const savedProject: Project = {
  id: 'project-1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1',
  source_link_id: null, name: 'Site da Empresa', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'not_started', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null,
  archived_at: null, created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

afterEach(cleanup)

describe('ProjectForm', () => {
  beforeEach(() => {
    listProjectFormOptions.mockReset().mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }, { id: 'client-2', name: 'Empresa B' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 0, remaining_cents: 100000, due_date: null,
      }, {
        id: 'contract-2', client_id: 'client-2', service: 'Landing page', total_value_cents: 200000,
        allocated_cents: 0, remaining_cents: 200000, due_date: null,
      }],
    })
    createProject.mockReset().mockResolvedValue(savedProject)
    updateProject.mockReset().mockResolvedValue(savedProject)
    toast.mockReset()
  })

  it('exige cliente, contrato e nome', async () => {
    render(<ProjectForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    await screen.findByLabelText('Cliente *')
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    expect((await screen.findByText('Selecione o cliente.')).textContent).toBe('Selecione o cliente.')
    expect(screen.getByText('Selecione o contrato.').textContent).toBe('Selecione o contrato.')
    expect(screen.getByText('Nome do projeto é obrigatório.').textContent).toBe('Nome do projeto é obrigatório.')
    expect(createProject).not.toHaveBeenCalled()
  })

  it('filtra contratos pelo cliente e envia centavos', async () => {
    const onSaved = vi.fn()
    render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    const client = await screen.findByLabelText('Cliente *')
    const contract = screen.getByLabelText('Contrato *') as HTMLSelectElement

    fireEvent.change(client, { target: { value: 'client-1' } })
    expect(Array.from(contract.options, (option) => option.value)).toEqual(['', 'contract-1'])
    fireEvent.change(client, { target: { value: 'client-2' } })
    expect(Array.from(contract.options, (option) => option.value)).toEqual(['', 'contract-2'])
    fireEvent.change(client, { target: { value: 'client-1' } })
    expect(Array.from(contract.options, (option) => option.value)).toEqual(['', 'contract-1'])

    fireEvent.change(contract, { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProject))
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1', contractId: 'contract-1', contractedValueCents: 100000,
    }))
  })

  it('rejeita alocação acima do saldo disponível do contrato', async () => {
    render(<ProjectForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect((await screen.findByText(/O valor excede o limite disponível/)).textContent)
      .toContain('O valor excede o limite disponível')
    expect(createProject).not.toHaveBeenCalled()
  })

  it('sugere prazo editável e rejeita prazo anterior ao início', async () => {
    render(<ProjectForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-11-25' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    expect((screen.getByLabelText('Prazo') as HTMLInputElement).value).toBe('2026-12-10')
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    expect((await screen.findByText('O prazo não pode anteceder o início.')).textContent)
      .toBe('O prazo não pode anteceder o início.')
  })

  it('omite o placeholder do contrato em edição e mantém somente a opção atual', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    listProjectFormOptions.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }, { id: 'client-2', name: 'Empresa B' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 100000,
        allocated_cents: 0, remaining_cents: 100000, due_date: null,
      }, {
        id: 'contract-1b', client_id: 'client-1', service: 'Landing page', total_value_cents: 200000,
        allocated_cents: 0, remaining_cents: 200000, due_date: null,
      }, {
        id: 'contract-2', client_id: 'client-2', service: 'Consultoria', total_value_cents: 300000,
        allocated_cents: 0, remaining_cents: 300000, due_date: null,
      }],
    })
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    const contract = await screen.findByLabelText('Contrato *') as HTMLSelectElement
    expect(contract.options).toHaveLength(1)
    expect(contract.value).toBe('contract-1')
    expect(contract.options[0].textContent).toContain('Site')
  })

  it('edita projeto usando o saldo disponível mais o valor já contratado como limite', async () => {
    const current: ProjectListItem = {
      ...savedProject, contracted_value_cents: 100000, client_name: 'Empresa A',
      progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    const updatedProject: Project = { ...savedProject, contracted_value_cents: 150000 }
    const onSaved = vi.fn()
    listProjectFormOptions.mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 200000,
        allocated_cents: 150000, remaining_cents: 50000, due_date: null,
      }],
    })
    updateProject.mockResolvedValue(updatedProject)
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={onSaved} />)
    await screen.findByLabelText('Contrato *')
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.500,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updatedProject))
    expect(updateProject).toHaveBeenCalledTimes(1)
    expect(updateProject).toHaveBeenCalledWith('project-1', expect.objectContaining({
      contractedValueCents: 150000,
    }))
  })

  it('não repete a criação nem oferece retry quando onSaved falha após persistir', async () => {
    const onSaved = vi.fn(() => { throw new Error('Falha na navegação') })
    render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    const submitButton = screen.getByRole('button', { name: 'Criar projeto' })
    fireEvent.click(submitButton)

    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(createProject).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect((submitButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(submitButton.closest('form') as HTMLFormElement)
    expect(createProject).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      'Projeto salvo, mas não foi possível concluir a próxima ação.', 'error',
    )
  })

  it('mantém mensagem, toast e retry quando a persistência falha', async () => {
    const onSaved = vi.fn()
    createProject.mockRejectedValueOnce(new Error('Falha ao persistir')).mockResolvedValueOnce(savedProject)
    render(<ProjectForm onCancel={vi.fn()} onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText('Cliente *'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Contrato *'), { target: { value: 'contract-1' } })
    fireEvent.change(screen.getByLabelText('Nome do projeto *'), { target: { value: 'Site da Empresa' } })
    fireEvent.change(screen.getByLabelText('Serviço *'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Valor alocado (R$) *'), { target: { value: '1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))

    expect((await screen.findByText('Falha ao persistir')).textContent).toBe('Falha ao persistir')
    expect(toast).toHaveBeenCalledWith('Falha ao persistir', 'error')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedProject))
    expect(createProject).toHaveBeenCalledTimes(2)
  })

  it('bloqueia edição quando o contrato atual está cancelado ou fora das opções', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    listProjectFormOptions.mockResolvedValue({ clients: [], contracts: [] })
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect((await screen.findByText(
      'O contrato atual está cancelado ou indisponível. A edição do projeto está bloqueada.',
    )).textContent).toBe('O contrato atual está cancelado ou indisponível. A edição do projeto está bloqueada.')
    expect(screen.queryByLabelText('Contrato *')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull()
    expect(updateProject).not.toHaveBeenCalled()
  })

  it('bloqueia edição de projeto cancelado com mensagem clara', async () => {
    const current: ProjectListItem = {
      ...savedProject, client_name: 'Empresa A', status: 'cancelled', archived_at: '2026-11-25T12:00:00Z',
      progressPercent: null, activeTasks: 0, completedTasks: 0,
    }
    render(<ProjectForm project={current} onCancel={vi.fn()} onSaved={vi.fn()} />)
    expect((await screen.findByText(
      'Projeto cancelado não pode ser editado. Reative o projeto antes de alterar seus dados.',
    )).textContent).toBe('Projeto cancelado não pode ser editado. Reative o projeto antes de alterar seus dados.')
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull()
    expect(updateProject).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/projects/ProjectForm.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement form and page**

Create `src/components/projects/ProjectForm.tsx`:

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatMoney, parseMoneyInput } from '../../lib/money'
import { suggestProjectDueDate } from '../../lib/projectProgress'
import { createProject, listProjectFormOptions, updateProject } from '../../services/projectService'
import type {
  Project,
  ProjectFormClientOption,
  ProjectFormOptions,
  ProjectListItem,
  ProjectPriority,
  ProjectWrite,
} from '../../types/project'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { Textarea } from '../ui/Textarea'

export interface ProjectFormProps {
  project?: ProjectListItem
  onCancel: () => void
  onSaved: (project: Project) => void
}

interface ProjectDraft {
  clientId: string
  contractId: string
  name: string
  service: string
  contractedValue: string
  description: string
  startDate: string
  dueDate: string
  responsibleName: string
  priority: ProjectPriority
}

type ProjectDraftErrors = Partial<Record<keyof ProjectDraft, string>>

const PRIORITY_OPTIONS: Array<{ value: ProjectPriority; label: string }> = [
  { value: 'very_high', label: 'Muito alta' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function centsInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

function initialDraft(project?: ProjectListItem): ProjectDraft {
  return {
    clientId: project?.client_id ?? '',
    contractId: project?.contract_id ?? '',
    name: project?.name ?? '',
    service: project?.service ?? '',
    contractedValue: project ? centsInput(project.contracted_value_cents) : '',
    description: project?.description ?? '',
    startDate: project?.start_date ?? '',
    dueDate: project?.due_date ?? '',
    responsibleName: project?.responsible_name ?? '',
    priority: project?.priority ?? 'medium',
  }
}

function withCurrentOption(
  options: ProjectFormClientOption[],
  current?: ProjectFormClientOption,
): ProjectFormClientOption[] {
  return current && !options.some((option) => option.id === current.id)
    ? [current, ...options]
    : options
}

export function ProjectForm({ project, onCancel, onSaved }: ProjectFormProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<ProjectDraft>(() => initialDraft(project))
  const [errors, setErrors] = useState<ProjectDraftErrors>({})
  const [options, setOptions] = useState<ProjectFormOptions | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dueDateEditedRef = useRef(Boolean(project?.due_date))
  const savingRef = useRef(false)
  const savedRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    let active = true
    void listProjectFormOptions().then(
      (result) => {
        if (!active) return
        setOptions(result)
      },
      (error: unknown) => {
        if (!active) return
        setLoadError(errorMessage(error, 'Não foi possível carregar clientes e contratos. Tente novamente.'))
      },
    )
    return () => { active = false }
  }, [reloadKey])

  const setField = <K extends keyof ProjectDraft,>(key: K, value: ProjectDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSaveError(null)
  }

  const clientOptions = withCurrentOption(
    options?.clients ?? [],
    project ? { id: project.client_id, name: project.client_name ?? project.client_id } : undefined,
  )
  const selectedContract = options?.contracts.find((contract) =>
    contract.id === draft.contractId && contract.client_id === draft.clientId,
  )
  const availableContracts = (options?.contracts ?? []).filter((contract) =>
    contract.client_id === draft.clientId && (!project || contract.id === project.contract_id),
  )
  const currentContractMissing = Boolean(options && project
    && !availableContracts.some((contract) => contract.id === project.contract_id))
  const editBlockedMessage = project?.status === 'cancelled'
    ? 'Projeto cancelado não pode ser editado. Reative o projeto antes de alterar seus dados.'
    : currentContractMissing
      ? 'O contrato atual está cancelado ou indisponível. A edição do projeto está bloqueada.'
      : null
  const allocationLimit = selectedContract
    ? selectedContract.remaining_cents + (project?.contracted_value_cents ?? 0)
    : 0
  const busy = saving

  const changeClient = (clientId: string) => {
    const contractStillValid = (options?.contracts ?? []).some((contract) =>
      contract.id === draft.contractId && contract.client_id === clientId,
    )
    setDraft((current) => ({
      ...current,
      clientId,
      contractId: contractStillValid ? current.contractId : '',
      service: contractStillValid ? current.service : '',
      contractedValue: contractStillValid ? current.contractedValue : '',
    }))
    setErrors((current) => ({
      ...current,
      clientId: undefined,
      contractId: undefined,
      service: undefined,
      contractedValue: undefined,
    }))
    setSaveError(null)
  }

  const changeContract = (contractId: string) => {
    const contract = availableContracts.find((option) => option.id === contractId)
    setDraft((current) => {
      const defaultService = contract?.service ?? ''
      const defaultValue = !project && contract?.allocated_cents === 0
        ? centsInput(contract.remaining_cents)
        : ''
      return {
        ...current,
        contractId,
        service: defaultService,
        contractedValue: project ? current.contractedValue : defaultValue,
        dueDate: dueDateEditedRef.current
          ? current.dueDate
          : suggestProjectDueDate(defaultService, current.startDate || null) ?? '',
      }
    })
    setErrors((current) => ({
      ...current,
      contractId: undefined,
      service: undefined,
      contractedValue: undefined,
      dueDate: undefined,
    }))
    setSaveError(null)
  }

  const changeService = (service: string) => {
    setDraft((current) => ({
      ...current,
      service,
      dueDate: dueDateEditedRef.current
        ? current.dueDate
        : suggestProjectDueDate(service, current.startDate || null) ?? '',
    }))
    setErrors((current) => ({ ...current, service: undefined, dueDate: undefined }))
    setSaveError(null)
  }

  const changeStartDate = (startDate: string) => {
    setDraft((current) => ({
      ...current,
      startDate,
      dueDate: dueDateEditedRef.current
        ? current.dueDate
        : suggestProjectDueDate(current.service, startDate || null) ?? '',
    }))
    setErrors((current) => ({ ...current, startDate: undefined, dueDate: undefined }))
    setSaveError(null)
  }

  const validate = (): ProjectDraftErrors => {
    const nextErrors: ProjectDraftErrors = {}
    if (!draft.clientId) nextErrors.clientId = 'Selecione o cliente.'
    if (!draft.contractId) nextErrors.contractId = 'Selecione o contrato.'
    if (draft.contractId && !selectedContract) {
      nextErrors.contractId = 'Contrato não disponível. Selecione outro contrato.'
    }
    if (!draft.name.trim()) nextErrors.name = 'Nome do projeto é obrigatório.'
    if (!draft.service.trim()) nextErrors.service = 'Informe o serviço.'

    const contractedValueCents = parseMoneyInput(draft.contractedValue)
    if (contractedValueCents === null) {
      nextErrors.contractedValue = 'Informe um valor válido.'
    } else if (selectedContract && contractedValueCents > allocationLimit) {
      nextErrors.contractedValue = `O valor excede o limite disponível de ${formatMoney(allocationLimit)}.`
    }

    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
      nextErrors.dueDate = 'O prazo não pode anteceder o início.'
    }
    return nextErrors
  }

  const save = async () => {
    if (savingRef.current || savedRef.current || !options || editBlockedMessage) return

    const nextErrors = validate()
    setErrors(nextErrors)
    setSaveError(null)
    if (Object.values(nextErrors).some(Boolean)) return

    const contractedValueCents = parseMoneyInput(draft.contractedValue)
    if (contractedValueCents === null || !selectedContract) return

    const payload: ProjectWrite = {
      clientId: draft.clientId,
      contractId: draft.contractId,
      name: draft.name.trim(),
      service: draft.service.trim(),
      contractedValueCents,
      description: draft.description.trim(),
      startDate: draft.startDate || null,
      dueDate: draft.dueDate || null,
      responsibleName: draft.responsibleName.trim(),
      priority: draft.priority,
    }

    savingRef.current = true
    setSaving(true)
    let savedProject: Project
    try {
      savedProject = project
        ? await updateProject(project.id, payload)
        : await createProject(payload)
    } catch (error) {
      if (!mountedRef.current) return
      const message = errorMessage(error, 'Não foi possível salvar o projeto. Tente novamente.')
      setSaveError(message)
      toast(message, 'error')
      return
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }

    if (!mountedRef.current) return
    savedRef.current = true
    setSaved(true)
    try {
      onSaved(savedProject)
    } catch {
      if (!mountedRef.current) return
      const message = 'Projeto salvo, mas não foi possível concluir a próxima ação.'
      setSaveError(message)
      toast(message, 'error')
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void save()
  }

  if (!options) {
    if (loadError) {
      return (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadError}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOptions(null)
                setLoadError(null)
                setReloadKey((key) => key + 1)
              }}
            >
              Tentar novamente
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-64" />
        <span className="sr-only">Carregando formulário de projeto…</span>
      </div>
    )
  }

  if (editBlockedMessage) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
        <p className="text-sm text-danger">{editBlockedMessage}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={onCancel}>Voltar</Button>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5" aria-busy={busy}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Cliente *"
          value={draft.clientId}
          options={clientOptions.map((client) => ({ value: client.id, label: client.name }))}
          placeholder="Selecione o cliente"
          error={errors.clientId}
          onChange={(event) => changeClient(event.target.value)}
          disabled={busy || Boolean(project)}
          required
        />
        <Select
          label="Contrato *"
          value={draft.contractId}
          options={availableContracts.map((contract) => ({
            value: contract.id,
            label: `${contract.service} · ${formatMoney(contract.remaining_cents)} disponível`,
          }))}
          placeholder={project ? undefined : 'Selecione o contrato'}
          error={errors.contractId}
          onChange={(event) => changeContract(event.target.value)}
          disabled={busy || Boolean(project) || !draft.clientId}
          required
        />
        <Input
          label="Nome do projeto *"
          value={draft.name}
          error={errors.name}
          onChange={(event) => setField('name', event.target.value)}
          disabled={busy}
          required
        />
        <Input
          label="Serviço *"
          value={draft.service}
          error={errors.service}
          onChange={(event) => changeService(event.target.value)}
          disabled={busy}
          required
        />
        <Input
          label="Valor alocado (R$) *"
          inputMode="decimal"
          placeholder="0,00"
          value={draft.contractedValue}
          error={errors.contractedValue}
          onChange={(event) => setField('contractedValue', event.target.value)}
          disabled={busy}
          required
        />
        <Select
          label="Prioridade"
          value={draft.priority}
          options={PRIORITY_OPTIONS}
          onChange={(event) => setField('priority', event.target.value as ProjectPriority)}
          disabled={busy}
        />
        <Input
          label="Início"
          type="date"
          value={draft.startDate}
          error={errors.startDate}
          onChange={(event) => changeStartDate(event.target.value)}
          disabled={busy}
        />
        <Input
          label="Prazo"
          type="date"
          value={draft.dueDate}
          error={errors.dueDate}
          onChange={(event) => {
            dueDateEditedRef.current = true
            setField('dueDate', event.target.value)
          }}
          disabled={busy}
        />
        <Input
          label="Responsável"
          value={draft.responsibleName}
          onChange={(event) => setField('responsibleName', event.target.value)}
          disabled={busy}
        />
      </div>

      {selectedContract && (
        <dl className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-elevated p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Total do contrato</dt>
            <dd className="mt-1 font-medium text-ink">{formatMoney(selectedContract.total_value_cents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Já alocado</dt>
            <dd className="mt-1 font-medium text-ink">{formatMoney(selectedContract.allocated_cents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Saldo disponível</dt>
            <dd className="mt-1 font-medium text-ink">{formatMoney(selectedContract.remaining_cents)}</dd>
          </div>
        </dl>
      )}

      {project && (
        <p className="text-xs text-muted">
          Cliente e contrato são fixos na edição.
          {selectedContract && ` O limite deste projeto é ${formatMoney(allocationLimit)}.`}
        </p>
      )}

      <Textarea
        label="Descrição"
        value={draft.description}
        onChange={(event) => setField('description', event.target.value)}
        disabled={busy}
        rows={4}
      />

      {saveError && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{saveError}</p>
          {!saved && (
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={busy}
              onClick={() => void save()}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" variant="mint" loading={busy} disabled={saved}>
          {project ? 'Salvar alterações' : 'Criar projeto'}
        </Button>
      </div>
    </form>
  )
}
```

Create `src/pages/ProjectNewPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { ProjectForm } from '../components/projects/ProjectForm'
import { Card } from '../components/ui/Card'
import { useToast } from '../hooks/useToast'

export function ProjectNewPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Novo projeto</h1>
        <p className="mt-1 text-sm text-muted">
          Vincule o projeto a um cliente e um contrato ativo. O prazo sugerido pode ser ajustado.
        </p>
      </div>
      <Card>
        <ProjectForm
          onCancel={() => navigate('/projetos')}
          onSaved={(project) => {
            toast('Projeto cadastrado com sucesso.')
            navigate(`/projetos/${project.id}`)
          }}
        />
      </Card>
    </div>
  )
}
```

`ProjectForm` não abre um `Modal` próprio: na página nova ele fica dentro de `Card`. Na Task 11, o mesmo formulário deve ser renderizado dentro do `Modal` existente (`wide`, título “Editar projeto”), que continua responsável pelo foco e por Escape. O conteúdo existente de `ProjectForm` e `ProjectNewPage` foi confirmado; não há `document.querySelector('form[aria-busy="true"]')` neste plano. O retry chama o `save` protegido por `savingRef`, e o envio normal continua pelo `submit` do próprio formulário. Em edição o seletor de contrato omite o placeholder; se o contrato atual estiver cancelado ou fora das opções ativas, o formulário bloqueia a edição com mensagem clara em vez de prometer um `update_project` que a RPC rejeita. Projetos cancelados também são bloqueados na UI; defensivamente, a RPC preserva seu valor sem realocação e registra essa decisão.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/components/projects/ProjectForm.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/ProjectForm.tsx src/components/projects/ProjectForm.test.tsx src/pages/ProjectNewPage.tsx
git commit -m "feat: adicionar cadastro de projeto"
```

---

### Task 8: Criar badges, cards, lista e Kanban de projetos

**Files:**
- Create: `src/components/projects/ProjectStatusBadge.tsx`
- Create: `src/components/projects/ProjectPriorityBadge.tsx`
- Create: `src/components/projects/ProjectCard.tsx`
- Create: `src/components/projects/ProjectKanbanColumn.tsx`
- Create: `src/pages/ProjectsPage.tsx`
- Create: `src/pages/ProjectsPage.test.tsx`
- Create: `src/components/projects/ProjectStatusBadge.test.tsx`
- Create: `src/components/projects/ProjectPriorityBadge.test.tsx`
- Create: `src/components/projects/ProjectCard.test.tsx`
- Create: `src/components/projects/ProjectKanbanColumn.test.tsx`

**Interfaces:**
- Consumes: `listProjects`, `listProjectsForBoard`, `useProjectStatusQueue`, `ProjectListItem`, `ProjectStatus`, `ProjectMoveStatus`, `PROJECT_STATUSES`, `PROJECT_MOVE_STATUSES`.
- Produces: view modes `cards`, `list`, `kanban`; display columns in `PROJECT_STATUSES` order, with only `PROJECT_MOVE_STATUSES` accepted as movement destinations.

- [ ] **Step 1: Write failing page/card tests**

```tsx
// @vitest-environment jsdom
// src/pages/ProjectsPage.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { DndContextProps, DragEndEvent } from '@dnd-kit/core'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_MOVE_STATUSES, type ProjectFilters, type ProjectListItem } from '../types/project'

const { listProjects, listProjectsForBoard, setProjectStatus } = vi.hoisted(() => ({
  listProjects: vi.fn(), listProjectsForBoard: vi.fn(), setProjectStatus: vi.fn(),
}))
const { listClients } = vi.hoisted(() => ({ listClients: vi.fn() }))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }))
vi.mock('../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectService')>()
  return { ...actual, listProjects, listProjectsForBoard, setProjectStatus }
})
vi.mock('../services/clientService', () => ({ listClients }))
vi.mock('../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props
      return <actual.DndContext {...props} />
    },
  }
})

import { ProjectsPage } from './ProjectsPage'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: 50, activeTasks: 2, completedTasks: 1,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

afterEach(() => {
  cleanup()
  dnd.props = null
})

describe('ProjectsPage', () => {
  beforeEach(() => {
    listProjects.mockReset().mockResolvedValue({ projects: [project], total: 1 })
    listProjectsForBoard.mockReset().mockResolvedValue({ projects: [project], partial: false })
    setProjectStatus.mockReset().mockResolvedValue({ ...project, status: 'in_review' })
    listClients.mockReset().mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }], total: 1,
    })
    toast.mockReset()
  })

  it('mostra cards com progresso derivado e sem tarefas ativas quando null', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect((await screen.findByText('Site da Empresa')).textContent).toBe('Site da Empresa')
    expect(screen.getByText('50%').textContent).toBe('50%')
    expect(screen.getByText('1 de 2 tarefas concluídas').textContent).toBe('1 de 2 tarefas concluídas')
    expect(screen.getByText('R$ 1.234,56').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56')
  })

  it('mostra Sem tarefas ativas quando progresso é null', async () => {
    listProjects.mockResolvedValue({ projects: [{ ...project, progressPercent: null }], total: 1 })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect((await screen.findByText('Sem tarefas ativas')).textContent).toBe('Sem tarefas ativas')
  })

  it('entrega estado vazio com link para cadastro', async () => {
    listProjects.mockResolvedValue({ projects: [], total: 0 })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect((await screen.findByText('Nenhum projeto encontrado.')).textContent)
      .toBe('Nenhum projeto encontrado.')
    expect(screen.getByRole('link', { name: 'Criar projeto' }).getAttribute('href')).toBe('/projetos/novo')
  })

  it('usa página de 24 itens e paginação estável', async () => {
    const projects = Array.from({ length: 24 }, (_, index) => ({
      ...project, id: `p${index}`, name: `Projeto ${index}`,
    }))
    listProjects.mockResolvedValue({ projects, total: 25 })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    expect(await screen.findByRole('link', { name: 'Projeto 0' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /^Projeto \d+$/ })).toHaveLength(24)
    expect(listProjects).toHaveBeenCalledWith({}, 'name_asc', 0, 24)
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    await waitFor(() => expect(listProjects).toHaveBeenLastCalledWith({}, 'name_asc', 1, 24))
  })

  it('aplica filtros de busca, cliente, status, prioridade e prazo', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.change(await screen.findByLabelText('Buscar projetos'), { target: { value: 'Site' } })
    await screen.findByRole('option', { name: 'Empresa A' })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_development' } })
    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Prazo inicial'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Prazo final'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await waitFor(() => expect(listProjects).toHaveBeenLastCalledWith({
      search: 'Site', clientId: 'client-1', status: 'in_development',
      priority: 'high', dueFrom: '2026-12-01', dueTo: '2026-12-31',
    }, 'name_asc', 0, 24))
  })

  it('descarta respostas obsoletas da lista', async () => {
    const old = deferred<{ projects: ProjectListItem[]; total: number }>()
    listProjects.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      projects: [{ ...project, id: 'new', name: 'Projeto novo' }], total: 1,
    })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Buscar projetos'), { target: { value: 'novo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect((await screen.findByText('Projeto novo')).textContent).toBe('Projeto novo')
    await act(async () => {
      old.resolve({ projects: [{ ...project, name: 'Projeto antigo' }], total: 1 })
      await old.promise
    })
    expect(screen.queryByText('Projeto antigo')).toBeNull()
    expect(screen.getByText('Projeto novo')).toBeTruthy()
  })

  it('preserva a lista válida e permite retry quando o refresh falha', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    await screen.findByText('Site da Empresa')
    listProjects.mockRejectedValueOnce(new Error('Falha ao atualizar projetos.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar projetos' }))
    expect((await screen.findByText('Falha ao atualizar projetos.')).textContent)
      .toBe('Falha ao atualizar projetos.')
    expect(screen.getByText('Site da Empresa')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('Kanban carrega até 500 e avisa quando o resultado é parcial', async () => {
    listProjectsForBoard.mockResolvedValue({ projects: [project], partial: true })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect((await screen.findByText(/até 500 projetos/)).textContent).toMatch(/até 500 projetos/)
    expect(listProjectsForBoard).toHaveBeenCalledWith({})
  })

  it('aplica os mesmos filtros da lista ao Kanban e atualiza o recorte ao limpar', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    await screen.findByRole('option', { name: 'Empresa A' })
    fireEvent.change(screen.getByLabelText('Buscar projetos'), { target: { value: 'Site' } })
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'client-1' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_development' } })
    fireEvent.change(screen.getByLabelText('Prioridade'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Prazo inicial'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Prazo final'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    await waitFor(() => expect(listProjectsForBoard).toHaveBeenLastCalledWith({
      search: 'Site', clientId: 'client-1', status: 'in_development',
      priority: 'high', dueFrom: '2026-12-01', dueTo: '2026-12-31',
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(listProjectsForBoard).toHaveBeenLastCalledWith({}))
  })

  it('mantém falha do board distinta de vazio e faz retry por requestRefresh', async () => {
    listProjectsForBoard.mockRejectedValueOnce(new Error('Falha ao carregar o Kanban.'))
      .mockResolvedValueOnce({ projects: [project], partial: false })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect((await screen.findByText('Falha ao carregar o Kanban.')).textContent)
      .toBe('Falha ao carregar o Kanban.')
    expect(screen.queryByText('Nenhum projeto no Kanban.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect((await screen.findByText('Site da Empresa')).textContent).toBe('Site da Empresa')
    expect(listProjectsForBoard).toHaveBeenCalledTimes(2)
    expect(listProjectsForBoard).toHaveBeenLastCalledWith({})
  })

  it('preserve o board anterior em falha de atualização manual', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    await screen.findByText('Site da Empresa')
    listProjectsForBoard.mockRejectedValueOnce(new Error('Falha no refresh do Kanban.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar Kanban' }))
    expect((await screen.findByText('Falha no refresh do Kanban.')).textContent)
      .toBe('Falha no refresh do Kanban.')
    expect(screen.getByText('Site da Empresa')).toBeTruthy()
  })

  it('adia a leitura do Kanban durante movimentação e aplica os filtros mais recentes', async () => {
    const pendingMove = deferred<ProjectListItem>()
    const pendingBoard = deferred<{ projects: ProjectListItem[]; partial: boolean }>()
    let moveConfirmed = false
    let filteredSnapshot: { projects: ProjectListItem[]; partial: boolean } | undefined
    setProjectStatus.mockReturnValueOnce(pendingMove.promise)
    listProjectsForBoard.mockImplementation((filters: ProjectFilters) => {
      const snapshot: { projects: ProjectListItem[]; partial: boolean } = {
        projects: [{ ...project, status: moveConfirmed ? 'in_review' : 'in_development' }],
        partial: false,
      }
      if (filters.search === 'Site') {
        filteredSnapshot = snapshot
        return pendingBoard.promise
      }
      return Promise.resolve(snapshot)
    })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    const selector = await screen.findByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(selector.value).toBe('in_development')
    fireEvent.change(selector, { target: { value: 'in_review' } })
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'in_review'))
    fireEvent.change(screen.getByLabelText('Buscar projetos'), { target: { value: 'Site' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(listProjectsForBoard).toHaveBeenCalledTimes(1)
    expect(listProjectsForBoard).toHaveBeenLastCalledWith({})
    const pendingSelector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(pendingSelector.value).toBe('in_review')
    expect(pendingSelector.disabled).toBe(true)

    await act(async () => {
      moveConfirmed = true
      pendingMove.resolve({ ...project, status: 'in_review' })
      await pendingMove.promise
    })
    await waitFor(() => expect(listProjectsForBoard).toHaveBeenCalledTimes(2))
    expect(listProjectsForBoard).toHaveBeenLastCalledWith({ search: 'Site' })
    expect(filteredSnapshot).toEqual({
      projects: [expect.objectContaining({ status: 'in_review' })], partial: false,
    })
    await act(async () => {
      pendingBoard.resolve(filteredSnapshot!)
      await pendingBoard.promise
    })
    const liveSelector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    await waitFor(() => {
      expect(liveSelector.disabled).toBe(false)
      expect(liveSelector.value).toBe('in_review')
    })
  })

  it('seletor mobile usa exatamente PROJECT_MOVE_STATUSES e move otimisticamente', async () => {
    const pending = deferred<ProjectListItem>()
    setProjectStatus.mockReturnValueOnce(pending.promise)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    const selector = await screen.findByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(Array.from(selector.options, (option) => option.value)).toEqual([...PROJECT_MOVE_STATUSES])
    fireEvent.change(selector, { target: { value: 'in_review' } })
    const pendingSelector = await screen.findByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(pendingSelector.value).toBe('in_review')
    expect(pendingSelector.disabled).toBe(true)
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'in_review'))
    await act(async () => {
      pending.resolve({ ...project, status: 'in_review' })
      await pending.promise
    })
    await waitFor(() => {
      const liveSelector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
      expect(liveSelector.disabled).toBe(false)
      expect(liveSelector.value).toBe('in_review')
    })
  })

  it('drag fora do board não move e falha faz rollback com toast', async () => {
    const pending = deferred<ProjectListItem>()
    setProjectStatus.mockReturnValueOnce(pending.promise)
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    await screen.findByText('Site da Empresa')
    const outside = { active: { id: 'project:p1' }, over: null } as unknown as DragEndEvent
    act(() => { dnd.props?.onDragEnd?.(outside) })
    expect(setProjectStatus).not.toHaveBeenCalled()
    const drop = {
      active: { id: 'project:p1' }, over: { id: 'column:in_review' },
    } as unknown as DragEndEvent
    act(() => { dnd.props?.onDragEnd?.(drop) })
    expect(setProjectStatus).toHaveBeenCalledWith('p1', 'in_review')
    await act(async () => {
      pending.reject(new Error('Não foi possível mover o projeto.'))
      await pending.promise.catch(() => undefined)
    })
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Não foi possível mover o projeto.', 'error'))
    const selector = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    await waitFor(() => expect(selector.value).toBe('in_development'))
  })

  it('mantém delivered visível, read-only e sem seletor de status', async () => {
    listProjectsForBoard.mockResolvedValue({
      projects: [project, { ...project, id: 'delivered', name: 'Projeto entregue', status: 'delivered' }],
      partial: false,
    })
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))
    expect((await screen.findByRole('link', { name: 'Projeto entregue' })).textContent)
      .toBe('Projeto entregue')
    expect(screen.getByRole('group', { name: 'Entregue' })).toBeTruthy()
    expect(screen.queryByLabelText('Status do projeto Projeto entregue')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Arrastar Projeto entregue' })).toBeNull()
  })
})
```

Create `src/components/projects/ProjectStatusBadge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PROJECT_STATUSES } from '../../types/project'
import { PROJECT_STATUS_LABELS, ProjectStatusBadge } from './ProjectStatusBadge'

afterEach(cleanup)

describe('ProjectStatusBadge', () => {
  it('renderiza todos os status de projeto com label próprio', () => {
    render(<div>{PROJECT_STATUSES.map((status) => <ProjectStatusBadge key={status} status={status} />)}</div>)
    for (const status of PROJECT_STATUSES) {
      expect(screen.getByText(PROJECT_STATUS_LABELS[status]).textContent).toBe(PROJECT_STATUS_LABELS[status])
    }
    expect(screen.queryByText('Em negociação')).toBeNull()
  })
})
```

Create `src/components/projects/ProjectPriorityBadge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectPriority } from '../../types/project'
import { PROJECT_PRIORITY_LABELS, ProjectPriorityBadge } from './ProjectPriorityBadge'

afterEach(cleanup)

describe('ProjectPriorityBadge', () => {
  it('renderiza as quatro prioridades sem reutilizar labels de leads', () => {
    const priorities: ProjectPriority[] = ['very_high', 'high', 'medium', 'low']
    render(<div>{priorities.map((priority) => <ProjectPriorityBadge key={priority} priority={priority} />)}</div>)
    for (const priority of priorities) {
      expect(screen.getByText(PROJECT_PRIORITY_LABELS[priority]).textContent).toBe(PROJECT_PRIORITY_LABELS[priority])
    }
  })
})
```

Create `src/components/projects/ProjectCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectListItem } from '../../types/project'
import { ProjectCard } from './ProjectCard'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: 'Ana',
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: 50, activeTasks: 2, completedTasks: 1,
}

afterEach(cleanup)

describe('ProjectCard', () => {
  it('mostra vínculo, prazo, valor e progresso derivado', () => {
    render(<MemoryRouter><ProjectCard project={project} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Site da Empresa' }).getAttribute('href')).toBe('/projetos/p1')
    expect(screen.getByText('Empresa A · Site').textContent).toBe('Empresa A · Site')
    expect(screen.getByText('10 de dez. de 2026').textContent).toBe('10 de dez. de 2026')
    expect(screen.getByText('R$ 1.234,56').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56')
    const progress = screen.getByRole('progressbar', { name: 'Progresso de Site da Empresa' })
    expect(progress.getAttribute('aria-valuenow')).toBe('50')
    expect(screen.getByText('50%').textContent).toBe('50%')
    expect(screen.getByText('1 de 2 tarefas concluídas').textContent).toBe('1 de 2 tarefas concluídas')
  })

  it('não inventa progresso sem tarefas ativas e sinaliza mutação pendente', () => {
    render(<MemoryRouter><ProjectCard project={{ ...project, progressPercent: null, activeTasks: 0 }} pending /></MemoryRouter>)
    expect(screen.getByText('Sem tarefas ativas').textContent).toBe('Sem tarefas ativas')
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Salvando movimentação…')
  })
})
```

Create `src/components/projects/ProjectKanbanColumn.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_MOVE_STATUSES, type ProjectListItem, type ProjectMoveStatus } from '../../types/project'
import { ProjectKanbanColumn } from './ProjectKanbanColumn'

const project: ProjectListItem = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: null, due_date: null, responsible_name: null, priority: 'high',
  status: 'planning', completed_at: null, delivered_at: null, delivery_confirmed_at: null,
  delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: null, activeTasks: 0, completedTasks: 0,
}

function Column({ status = 'planning', projects = [project], pendingIds = new Set<string>(), onMove = vi.fn() }: {
  status?: ProjectListItem['status']
  projects?: ProjectListItem[]
  pendingIds?: ReadonlySet<string>
  onMove?: (id: string, status: ProjectMoveStatus) => Promise<void>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  return (
    <DndContext sensors={sensors}>
      <ProjectKanbanColumn status={status} projects={projects} pendingIds={pendingIds} onMove={onMove} />
    </DndContext>
  )
}

afterEach(cleanup)

describe('ProjectKanbanColumn', () => {
  it('oferece apenas destinos móveis e chama a fila da página', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined)
    render(<Column onMove={onMove} />)
    const select = screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement
    expect(Array.from(select.options, (option) => option.value)).toEqual([...PROJECT_MOVE_STATUSES])
    fireEvent.change(select, { target: { value: 'in_review' } })
    await waitFor(() => expect(onMove).toHaveBeenCalledWith('p1', 'in_review'))
    expect(screen.getByRole('button', { name: 'Arrastar Site da Empresa' })).toBeTruthy()
  })

  it('desabilita handle e seletor enquanto o projeto está pendente', () => {
    render(<Column pendingIds={new Set(['p1'])} />)
    expect((screen.getByRole('button', { name: 'Arrastar Site da Empresa' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Status do projeto Site da Empresa') as HTMLSelectElement).disabled).toBe(true)
  })

  it('mantém delivered visível e read-only sem hook de arraste nem seletor', () => {
    render(<Column status="delivered" projects={[{ ...project, status: 'delivered' }]} />)
    expect(screen.getByRole('group', { name: 'Entregue' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arrastar Site da Empresa' })).toBeNull()
    expect(screen.queryByLabelText('Status do projeto Site da Empresa')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/ProjectsPage.test.tsx src/components/projects/ProjectStatusBadge.test.tsx src/components/projects/ProjectPriorityBadge.test.tsx src/components/projects/ProjectCard.test.tsx src/components/projects/ProjectKanbanColumn.test.tsx`
Expected: FAIL with modules not found.

- [ ] **Step 3: Implement shared presentation and page**

Create project-specific badges so lead badge behavior remains unchanged. Labels:

```ts
const STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Não iniciado', planning: 'Planejamento', in_development: 'Em desenvolvimento',
  awaiting_client_info: 'Aguardando cliente', in_review: 'Em revisão',
  awaiting_approval: 'Aguardando aprovação', changes_requested: 'Alterações solicitadas',
  completed: 'Concluído', delivered: 'Entregue', cancelled: 'Cancelado',
}
```

Create `src/components/projects/ProjectStatusBadge.tsx`:

```tsx
import type { ProjectStatus } from '../../types/project'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Não iniciado', planning: 'Planejamento', in_development: 'Em desenvolvimento',
  awaiting_client_info: 'Aguardando cliente', in_review: 'Em revisão',
  awaiting_approval: 'Aguardando aprovação', changes_requested: 'Alterações solicitadas',
  completed: 'Concluído', delivered: 'Entregue', cancelled: 'Cancelado',
}

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  not_started: 'bg-elevated text-muted',
  planning: 'bg-accent/15 text-accent',
  in_development: 'bg-primary/15 text-primary',
  awaiting_client_info: 'bg-lime/15 text-lime',
  in_review: 'bg-accent/15 text-accent',
  awaiting_approval: 'bg-lime/15 text-lime',
  changes_requested: 'bg-danger/15 text-danger',
  completed: 'bg-mint/15 text-mint',
  delivered: 'bg-primary/15 text-primary',
  cancelled: 'bg-danger/10 text-danger',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  )
}
```

Create `src/components/projects/ProjectPriorityBadge.tsx`:

```tsx
import type { ProjectPriority } from '../../types/project'

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  very_high: 'Muito alta', high: 'Alta', medium: 'Média', low: 'Baixa',
}

const PRIORITY_CLASSES: Record<ProjectPriority, string> = {
  very_high: 'bg-danger/15 text-danger', high: 'bg-lime/15 text-lime',
  medium: 'bg-accent/15 text-accent', low: 'bg-elevated text-muted',
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_CLASSES[priority]}`}>
      {PROJECT_PRIORITY_LABELS[priority]}
    </span>
  )
}
```

Create `src/components/projects/ProjectCard.tsx`:

```tsx
import { Link, useInRouterContext } from 'react-router-dom'
import { formatMoney } from '../../lib/money'
import type { ProjectListItem } from '../../types/project'
import { Card } from '../ui/Card'
import { ProjectPriorityBadge } from './ProjectPriorityBadge'
import { ProjectStatusBadge } from './ProjectStatusBadge'

export interface ProjectCardProps {
  project: ProjectListItem
  pending?: boolean
}

export function formatProjectDate(value: string | null): string {
  if (!value) return 'Não definido'
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

export function ProjectCard({ project, pending = false }: ProjectCardProps) {
  const inRouter = useInRouterContext()
  const titleClassName = 'font-display text-base font-bold text-ink hover:text-primary'
  return (
    <Card className={`flex h-full flex-col gap-4 ${pending ? 'border-lime/50' : ''}`} aria-busy={pending}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {inRouter ? (
            <Link className={titleClassName} to={`/projetos/${project.id}`}>{project.name}</Link>
          ) : (
            <a className={titleClassName} href={`/projetos/${project.id}`}>{project.name}</a>
          )}
          <p className="mt-1 text-sm text-muted">
            {project.client_name ? `${project.client_name} · ` : ''}{project.service}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        <ProjectPriorityBadge priority={project.priority} />
        <span className="rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-ink">
          {formatMoney(project.contracted_value_cents)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Prazo</dt>
          <dd className="mt-1 text-ink">{formatProjectDate(project.due_date)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Responsável</dt>
          <dd className="mt-1 text-ink">{project.responsible_name || 'Não definido'}</dd>
        </div>
      </dl>
      <div className="mt-auto">
        {project.progressPercent === null ? (
          <p className="text-sm text-muted">Sem tarefas ativas</p>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Progresso</span>
              <span>{project.progressPercent}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-elevated"
              role="progressbar"
              aria-label={`Progresso de ${project.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={project.progressPercent}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {project.completedTasks} de {project.activeTasks} tarefas concluídas
            </p>
          </>
        )}
      </div>
      {pending && <span role="status" className="text-xs text-lime">Salvando movimentação…</span>}
    </Card>
  )
}
```

Create `src/components/projects/ProjectKanbanColumn.tsx`:

```tsx
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import {
  PROJECT_MOVE_STATUSES,
  type ProjectListItem,
  type ProjectMoveStatus,
  type ProjectStatus,
} from '../../types/project'
import { Select } from '../ui/Select'
import { ProjectCard } from './ProjectCard'
import { PROJECT_STATUS_LABELS } from './ProjectStatusBadge'

interface ProjectKanbanColumnProps {
  status: ProjectStatus
  projects: ProjectListItem[]
  pendingIds: ReadonlySet<string>
  onMove: (id: string, status: ProjectMoveStatus) => Promise<void>
}

function isMoveStatus(status: string): status is ProjectMoveStatus {
  return (PROJECT_MOVE_STATUSES as readonly string[]).includes(status)
}

function ProjectStatusControl({
  project, pending, onMove,
}: {
  project: ProjectListItem
  pending: boolean
  onMove: ProjectKanbanColumnProps['onMove']
}) {
  if (project.status === 'delivered') return null
  return (
    <Select
      label={`Status do projeto ${project.name}`}
      value={project.status}
      options={PROJECT_MOVE_STATUSES.map((status) => ({
        value: status, label: PROJECT_STATUS_LABELS[status],
      }))}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value
        if (pending || !isMoveStatus(next)) return
        void onMove(project.id, next)
      }}
    />
  )
}

function ReadOnlyColumn({ status, projects, pendingIds }: Omit<ProjectKanbanColumnProps, 'onMove'>) {
  return (
    <section className="w-[300px] shrink-0 rounded-2xl border border-line bg-surface p-3" aria-label={PROJECT_STATUS_LABELS[status]} role="group">
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-bold text-ink">{PROJECT_STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted">{projects.length}</span>
      </header>
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} pending={pendingIds.has(project.id)} />
        ))}
        {projects.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            {status === 'delivered' ? 'Histórico de entregas.' : 'Projetos cancelados não aparecem nesta visão.'}
          </p>
        )}
      </div>
    </section>
  )
}

function MovableColumn({ status, projects, pendingIds, onMove }: ProjectKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` })
  return (
    <section
      ref={setNodeRef}
      className={`w-[300px] shrink-0 rounded-2xl border p-3 ${isOver ? 'border-primary bg-primary/5' : 'border-line bg-surface'}`}
      aria-label={PROJECT_STATUS_LABELS[status]}
      role="group"
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-bold text-ink">{PROJECT_STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted">{projects.length}</span>
      </header>
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <DraggableProjectCard
            key={project.id}
            project={project}
            pending={pendingIds.has(project.id)}
            onMove={onMove}
          />
        ))}
        {projects.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Arraste projetos para cá.
          </p>
        )}
      </div>
    </section>
  )
}

function DraggableProjectCard({
  project, pending, onMove,
}: {
  project: ProjectListItem
  pending: boolean
  onMove: ProjectKanbanColumnProps['onMove']
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `project:${project.id}`,
    disabled: pending || project.status === 'delivered',
  })
  return (
    <div className="flex flex-col gap-2">
      <div ref={setNodeRef} {...attributes}>
        <ProjectCard project={project} pending={pending} />
        <button
          type="button"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Arrastar ${project.name}`}
          disabled={pending}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ProjectStatusControl project={project} pending={pending} onMove={onMove} />
    </div>
  )
}

export function ProjectKanbanColumn(props: ProjectKanbanColumnProps) {
  return isMoveStatus(props.status) ? <MovableColumn {...props} /> : <ReadOnlyColumn {...props} />
}
```

A coluna `delivered` não chama hooks de DnD nem renderiza seletor de status. Nas colunas móveis, o link e o seletor ficam fora do handle que recebe os listeners; soltar fora de qualquer `column:*` não produz mutação.

Create `src/pages/ProjectsPage.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  DndContext, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { FolderKanban, LayoutGrid, List, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjectStatusQueue } from '../hooks/useProjectStatusQueue'
import { useToast } from '../hooks/useToast'
import { formatMoney } from '../lib/money'
import { listClients } from '../services/clientService'
import { listProjects, listProjectsForBoard } from '../services/projectService'
import {
  PROJECT_MOVE_STATUSES, PROJECT_STATUSES,
  type ProjectFilters, type ProjectListItem, type ProjectMoveStatus,
  type ProjectPriority, type ProjectSort, type ProjectStatus,
} from '../types/project'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { ProjectCard, formatProjectDate } from '../components/projects/ProjectCard'
import { ProjectKanbanColumn } from '../components/projects/ProjectKanbanColumn'
import { PROJECT_PRIORITY_LABELS, ProjectPriorityBadge } from '../components/projects/ProjectPriorityBadge'
import { PROJECT_STATUS_LABELS, ProjectStatusBadge } from '../components/projects/ProjectStatusBadge'

type ViewMode = 'cards' | 'list' | 'kanban'
interface FilterDraft {
  search: string
  clientId: string
  status: string
  priority: string
  dueFrom: string
  dueTo: string
}

const EMPTY_FILTERS: FilterDraft = {
  search: '', clientId: '', status: '', priority: '', dueFrom: '', dueTo: '',
}
const SORT_OPTIONS: Array<{ value: ProjectSort; label: string }> = [
  { value: 'name_asc', label: 'Nome: A–Z' },
  { value: 'name_desc', label: 'Nome: Z–A' },
  { value: 'due_asc', label: 'Prazo mais próximo' },
  { value: 'due_desc', label: 'Prazo mais distante' },
  { value: 'created_desc', label: 'Mais recentes' },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isMoveStatus(value: string): value is ProjectMoveStatus {
  return (PROJECT_MOVE_STATUSES as readonly string[]).includes(value)
}

function ProjectEmptyState() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Nenhum projeto encontrado."
      description="Cadastre o primeiro projeto ou ajuste os filtros para ver outros resultados."
      action={(
        <Link
          to="/projetos/novo"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-medium text-bg transition-colors hover:bg-mint/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Criar projeto
        </Link>
      )}
    />
  )
}

export function ProjectsPage() {
  const { toast } = useToast()
  const [view, setView] = useState<ViewMode>('cards')
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [sort, setSort] = useState<ProjectSort>('name_asc')
  const [page, setPage] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [listResult, setListResult] = useState<{ projects: ProjectListItem[]; total: number }>({
    projects: [], total: 0,
  })
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listHasLoaded, setListHasLoaded] = useState(false)
  const [clientOptions, setClientOptions] = useState<Array<{ value: string; label: string }>>([])
  const [clientLoadError, setClientLoadError] = useState<string | null>(null)
  const [boardProjects, setBoardProjects] = useState<ProjectListItem[]>([])
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardPartial, setBoardPartial] = useState(false)
  const [boardHasLoaded, setBoardHasLoaded] = useState(false)
  const listRequestRef = useRef(0)
  const boardRequestRef = useRef(0)
  const mountedRef = useRef(true)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    mountedRef.current = true
    let active = true
    void listClients({ search: '', status: '', city: '' }, 'name_asc', 0, 100).then(
      (result) => {
        if (!active) return
        setClientOptions(result.clients.map((client) => ({ value: client.id, label: client.name })))
      },
      () => {
        if (active) setClientLoadError('Não foi possível carregar o filtro de clientes.')
      },
    )
    return () => {
      active = false
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (view === 'kanban') return
    let active = true
    const request = ++listRequestRef.current
    setListLoading(true)
    setListError(null)
    void listProjects(filters, sort, page, 24).then(
      (result) => {
        if (!active || !mountedRef.current || request !== listRequestRef.current) return
        setListResult(result)
        setListHasLoaded(true)
        setListLoading(false)
      },
      (error: unknown) => {
        if (!active || !mountedRef.current || request !== listRequestRef.current) return
        setListError(errorMessage(error, 'Não foi possível carregar os projetos. Tente novamente.'))
        setListLoading(false)
      },
    )
    return () => { active = false }
  }, [view, filters, sort, page, reloadKey])

  const loadBoard = useCallback(async (): Promise<void> => {
    const request = ++boardRequestRef.current
    setBoardLoading(true)
    setBoardError(null)
    try {
      const result = await listProjectsForBoard(filters)
      if (!mountedRef.current || request !== boardRequestRef.current) return
      setBoardProjects(result.projects)
      setBoardPartial(result.partial)
      setBoardHasLoaded(true)
    } catch (error) {
      if (!mountedRef.current || request !== boardRequestRef.current) return
      setBoardError(errorMessage(error, 'Não foi possível carregar o Kanban. Tente novamente.'))
    } finally {
      if (mountedRef.current && request === boardRequestRef.current) setBoardLoading(false)
    }
  }, [filters])

  const queue = useProjectStatusQueue({
    projects: boardProjects,
    onChange: setBoardProjects,
    onRefresh: loadBoard,
  })

  useEffect(() => {
    if (view !== 'kanban') return
    void queue.requestRefresh()
  }, [view, filters, queue.requestRefresh])

  const changeView = (next: ViewMode) => {
    if (next === view) return
    listRequestRef.current += 1
    boardRequestRef.current += 1
    setView(next)
  }

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: ProjectFilters = {}
    if (draftFilters.search.trim()) next.search = draftFilters.search.trim()
    if (draftFilters.clientId) next.clientId = draftFilters.clientId
    if (draftFilters.status) next.status = draftFilters.status as ProjectStatus
    if (draftFilters.priority) next.priority = draftFilters.priority as ProjectPriority
    if (draftFilters.dueFrom) next.dueFrom = draftFilters.dueFrom
    if (draftFilters.dueTo) next.dueTo = draftFilters.dueTo
    setFilters(next)
    setPage(0)
  }

  const moveProject = useCallback(async (id: string, status: ProjectMoveStatus): Promise<void> => {
    try {
      await queue.moveProject(id, status)
    } catch (error) {
      toast(errorMessage(error, 'Não foi possível mover o projeto. Tente novamente.'), 'error')
    }
  }, [queue.moveProject, toast])

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (!activeId.startsWith('project:') || !overId.startsWith('column:')) return
    const status = overId.slice('column:'.length)
    if (!isMoveStatus(status)) return
    void moveProject(activeId.slice('project:'.length), status)
  }

  const refreshBoard = () => {
    void queue.requestRefresh().catch((error: unknown) => {
      toast(errorMessage(error, 'Não foi possível atualizar o Kanban.'), 'error')
    })
  }
  const totalPages = Math.max(1, Math.ceil(listResult.total / 24))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Projetos</h1>
          <p className="mt-1 text-sm text-muted">Acompanhe execução, tarefas e entregas sem alterar o financeiro.</p>
        </div>
        <Link
          to="/projetos/novo"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-medium text-bg transition-colors hover:bg-mint/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Novo projeto
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" aria-label="Modo de visualização">
          <Button variant={view === 'cards' ? 'primary' : 'outline'} aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
            <LayoutGrid className="mr-2 h-4 w-4" aria-hidden="true" />Cards
          </Button>
          <Button variant={view === 'list' ? 'primary' : 'outline'} aria-pressed={view === 'list'} onClick={() => changeView('list')}>
            <List className="mr-2 h-4 w-4" aria-hidden="true" />Lista
          </Button>
          <Button variant={view === 'kanban' ? 'primary' : 'outline'} aria-pressed={view === 'kanban'} onClick={() => changeView('kanban')}>
            <FolderKanban className="mr-2 h-4 w-4" aria-hidden="true" />Kanban
          </Button>
        </div>
        {view === 'kanban' ? (
          <Button variant="outline" loading={boardLoading} onClick={refreshBoard}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Atualizar Kanban
          </Button>
        ) : (
          <Button variant="outline" loading={listLoading} onClick={() => setReloadKey((key) => key + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Atualizar projetos
          </Button>
        )}
      </div>

      <Card>
        <form className="flex flex-col gap-4" onSubmit={applyFilters}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Buscar projetos" value={draftFilters.search} onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))} />
            <Select
              label="Cliente"
              value={draftFilters.clientId}
              options={[{ value: '', label: 'Todos os clientes' }, ...clientOptions]}
              onChange={(event) => setDraftFilters((current) => ({ ...current, clientId: event.target.value }))}
            />
            <Select
              label="Status"
              value={draftFilters.status}
              options={[{ value: '', label: 'Todos os status' }, ...PROJECT_STATUSES.map((status) => ({ value: status, label: PROJECT_STATUS_LABELS[status] }))]}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}
            />
            <Select
              label="Prioridade"
              value={draftFilters.priority}
              options={[{ value: '', label: 'Todas as prioridades' }, ...Object.entries(PROJECT_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))]}
              onChange={(event) => setDraftFilters((current) => ({ ...current, priority: event.target.value }))}
            />
            <Input label="Prazo inicial" type="date" value={draftFilters.dueFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, dueFrom: event.target.value }))} />
            <Input label="Prazo final" type="date" value={draftFilters.dueTo} onChange={(event) => setDraftFilters((current) => ({ ...current, dueTo: event.target.value }))} />
            <Select label="Ordenação" value={sort} options={SORT_OPTIONS} onChange={(event) => { setSort(event.target.value as ProjectSort); setPage(0) }} />
          </div>
          {clientLoadError && <p className="text-sm text-danger">{clientLoadError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={() => { setDraftFilters(EMPTY_FILTERS); setFilters({}); setPage(0) }}>Limpar filtros</Button>
          </div>
        </form>
      </Card>

      {view === 'kanban' ? (
        <section className="flex flex-col gap-4" aria-label="Kanban de projetos">
          <p className="text-sm text-muted">Kanban com os filtros aplicados, limitado a 500 projetos não arquivados e não cancelados.</p>
          {boardPartial && (
            <div className="rounded-xl border border-lime/40 bg-lime/5 p-4 text-sm text-lime" role="status">
              Mostrando até 500 projetos. O resultado do Kanban é parcial; use a lista filtrada para localizar projetos fora deste recorte.
            </div>
          )}
          {boardError && (
            <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <p className="text-sm text-danger">{boardError}</p>
              <Button type="button" variant="outline" className="mt-3" onClick={refreshBoard}>Tentar novamente</Button>
            </div>
          )}
          {boardLoading && !boardHasLoaded ? (
            <div className="flex gap-4 overflow-x-auto pb-3" aria-busy="true">
              {PROJECT_STATUSES.map((status) => <Skeleton key={status} className="h-80 w-[300px] shrink-0" />)}
              <span className="sr-only">Carregando Kanban…</span>
            </div>
          ) : boardHasLoaded ? (
            queue.projects.length === 0 ? boardError ? null : <ProjectEmptyState /> : (
              <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {PROJECT_STATUSES.map((status) => (
                    <ProjectKanbanColumn
                      key={status}
                      status={status}
                      projects={queue.projects.filter((project) => project.status === status)}
                      pendingIds={queue.pendingIds}
                      onMove={moveProject}
                    />
                  ))}
                </div>
              </DndContext>
            )
          ) : null}
        </section>
      ) : (
        <section aria-label="Projetos">
          {listError && (
            <div className="mb-4 rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
              <p className="text-sm text-danger">{listError}</p>
              <Button type="button" variant="outline" className="mt-3" onClick={() => setReloadKey((key) => key + 1)}>Tentar novamente</Button>
            </div>
          )}
          {listLoading && !listHasLoaded ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-64" />)}
              <span className="sr-only">Carregando projetos…</span>
            </div>
          ) : !listHasLoaded && listError ? null : listHasLoaded && listResult.projects.length === 0 && !listError ? <ProjectEmptyState /> : (
            <>
              {view === 'cards' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={listLoading}>
                  {listResult.projects.map((project) => <ProjectCard key={project.id} project={project} />)}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-surface" aria-busy={listLoading}>
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase text-muted">
                      <tr>
                        <th className="px-4 py-3">Projeto</th><th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Prioridade</th><th className="px-4 py-3">Prazo</th>
                        <th className="px-4 py-3">Valor</th><th className="px-4 py-3">Progresso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listResult.projects.map((project) => (
                        <tr key={project.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-3">
                            <Link className="font-semibold text-ink hover:text-primary" to={`/projetos/${project.id}`}>{project.name}</Link>
                            <p className="text-xs text-muted">{project.client_name || project.client_id} · {project.service}</p>
                          </td>
                          <td className="px-4 py-3"><ProjectStatusBadge status={project.status} /></td>
                          <td className="px-4 py-3"><ProjectPriorityBadge priority={project.priority} /></td>
                          <td className="px-4 py-3">{formatProjectDate(project.due_date)}</td>
                          <td className="px-4 py-3">{formatMoney(project.contracted_value_cents)}</td>
                          <td className="px-4 py-3">{project.progressPercent === null ? 'Sem tarefas ativas' : `${project.progressPercent}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">Página {page + 1} de {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Página anterior</Button>
                  <Button variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Próxima página</Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
```

Cards, lista e Kanban compartilham o mesmo `ProjectFilters`; `listProjectsForBoard(filters)` aplica busca, cliente, status, prioridade e prazo antes de anexar métricas. A fila é a única chamadora de `setProjectStatus`; carregamento inicial, filtros/view, retry e refresh manual passam por `requestRefresh`. Durante uma mutação, a leitura é adiada e usa o callback com os filtros mais recentes após a fila esvaziar, evitando que um snapshot obsoleto reponha o status confirmado. O formulário de filtros permanece visível também no Kanban.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/pages/ProjectsPage.test.tsx src/components/projects/ProjectStatusBadge.test.tsx src/components/projects/ProjectPriorityBadge.test.tsx src/components/projects/ProjectCard.test.tsx src/components/projects/ProjectKanbanColumn.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/ProjectStatusBadge.tsx src/components/projects/ProjectPriorityBadge.tsx src/components/projects/ProjectCard.tsx src/components/projects/ProjectKanbanColumn.tsx src/components/projects/ProjectStatusBadge.test.tsx src/components/projects/ProjectPriorityBadge.test.tsx src/components/projects/ProjectCard.test.tsx src/components/projects/ProjectKanbanColumn.test.tsx src/pages/ProjectsPage.tsx src/pages/ProjectsPage.test.tsx
git commit -m "feat: adicionar lista e kanban de projetos"
```

---

### Task 9: Implementar tarefas, progresso e exclusão confirmada

**Files:**
- Create: `src/components/projects/ProjectTaskList.tsx`
- Create: `src/components/projects/ProjectTaskList.test.tsx`

**Interfaces:**
- Consumes: task service functions, `calculateProjectProgress`, `ProjectTaskWrite`.
- Produces: task modal, inline status change, delete confirmation and progress summary.

## Controller addendum — isolamento por projeto

Este adendo incorpora o fix round 1 aprovado após a revisão independente:

- Associar `projectId` a todos os estados de carga e reter a lista anterior somente quando o ID for o mesmo.
- Derivar `currentTasks` somente para o projeto atual e exibir loading enquanto o estado ainda pertence ao projeto anterior.
- Ao trocar de projeto, fechar formulário e confirmação, limpar `editingTask`, `deleteCandidate`, rascunho e erros.
- Bloquear edição, status, exclusão e reordenação quando `task.project_id !== projectId`; o submit de edição também rejeita tarefa estrangeira.
- Preservar `saving`/`savingRef` como guarda global até a mutação anterior terminar.
- O botão de edição deve ter nome acessível `Editar tarefa ${task.title}`.
- A suíte focalizada final deve ter 14 testes, incluindo título obrigatório, falha de carga após troca, fechamento dos diálogos e nome acessível.

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
// src/components/projects/ProjectTaskList.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectTask } from '../../types/project'

const { listTasks, createTask, updateTask, deleteTask, reorderTasks } = vi.hoisted(() => ({
  listTasks: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), reorderTasks: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectTaskService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectTaskService')>()
  return { ...actual, listTasks, createTask, updateTask, deleteTask, reorderTasks }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectTaskList } from './ProjectTaskList'

function makeTask(
  id: string,
  title: string,
  status: ProjectTask['status'] = 'pending',
  position = 0,
): ProjectTask {
  return {
    id, owner_id: 'owner-1', project_id: 'p1', title, description: null, status,
    responsible_name: null, start_date: null, due_date: null, priority: 'medium', position,
    notes: null, completed_at: null, cancelled_at: null,
    created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  }
}

afterEach(cleanup)

describe('ProjectTaskList', () => {
  beforeEach(() => {
    listTasks.mockReset().mockResolvedValue([])
    createTask.mockReset()
    updateTask.mockReset()
    deleteTask.mockReset()
    reorderTasks.mockReset()
    toast.mockReset()
  })

  it('mostra estado vazio e Sem tarefas ativas sem inventar progresso', async () => {
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    expect((await screen.findByText('Nenhuma tarefa cadastrada.')).textContent).toBe('Nenhuma tarefa cadastrada.')
    expect(screen.getByText('Sem tarefas ativas').textContent).toBe('Sem tarefas ativas')
  })

  it('cria tarefa e recalcula progresso pelos dados confirmados', async () => {
    listTasks.mockResolvedValueOnce([]).mockResolvedValueOnce([
      makeTask('t1', 'Layout', 'completed', 0),
      makeTask('t2', 'Conteúdo', 'pending', 1),
    ])
    createTask.mockResolvedValue({ id: 't1' })
    const onChanged = vi.fn()
    render(<ProjectTaskList projectId="p1" onChanged={onChanged} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Layout' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect((await screen.findByText('50%')).textContent).toBe('50%')
  })

  it('exige confirmação antes de excluir tarefa', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    deleteTask.mockResolvedValue({ id: 't1' })
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir tarefa Layout' }))
    expect(deleteTask).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Excluir tarefa Layout/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith('t1'))
  })

  it('bloqueia prazo anterior ao início', async () => {
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Tarefa' } })
    fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2026-11-25' } })
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    expect((await screen.findByText('O prazo não pode anteceder o início.')).textContent)
      .toBe('O prazo não pode anteceder o início.')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('atualiza status com payload integral sem enviar timestamps', async () => {
    const existing = makeTask('t1', 'Layout')
    listTasks.mockResolvedValue([existing])
    updateTask.mockResolvedValue({ ...existing, status: 'completed' })
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Status da tarefa Layout'), { target: { value: 'completed' } })
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith('t1', {
      title: 'Layout', description: '', status: 'completed', responsibleName: '',
      startDate: null, dueDate: null, priority: 'medium', notes: '',
    }))
    const payload = updateTask.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('completed_at')
    expect(payload).not.toHaveProperty('cancelled_at')
  })

  it('reordena enviando todos os IDs na nova ordem', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Primeira', 'pending', 0), makeTask('t2', 'Segunda', 'pending', 1)])
    reorderTasks.mockResolvedValue(undefined)
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mover tarefa Primeira para baixo' }))
    await waitFor(() => expect(reorderTasks).toHaveBeenCalledWith('p1', ['t2', 't1']))
  })

  it('preserva a última lista e permite retry após falha de refresh', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Layout')
    listTasks.mockRejectedValueOnce(new Error('Falha ao atualizar tarefas.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar tarefas' }))
    expect((await screen.findByText('Falha ao atualizar tarefas.')).textContent).toBe('Falha ao atualizar tarefas.')
    expect(screen.getByText('Layout')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('descarta resposta de um projeto anterior', async () => {
    const old = deferred<ProjectTask[]>()
    listTasks.mockReturnValueOnce(old.promise).mockResolvedValueOnce([makeTask('t2', 'Tarefa nova')])
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    expect((await screen.findByText('Tarefa nova')).textContent).toBe('Tarefa nova')
    await act(async () => {
      old.resolve([makeTask('t1', 'Tarefa antiga')])
      await old.promise
    })
    expect(screen.queryByText('Tarefa antiga')).toBeNull()
  })

  it('projeto cancelado preserva histórico e desabilita mutações', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} disabled />)
    await screen.findByText('Layout')
    expect(screen.getByText(/Projeto cancelado/).textContent).toMatch(/Projeto cancelado/)
    expect((screen.getByRole('button', { name: 'Nova tarefa' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Status da tarefa Layout') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Excluir tarefa Layout' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('exige título antes de criar tarefa', async () => {
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))
    expect((await screen.findByText('Informe o título da tarefa.')).textContent)
      .toBe('Informe o título da tarefa.')
    expect(createTask).not.toHaveBeenCalled()
  })

  it('não preserva tarefas do projeto anterior quando a carga do novo projeto falha', async () => {
    listTasks
      .mockResolvedValueOnce([makeTask('t1', 'Tarefa antiga')])
      .mockRejectedValueOnce(new Error('Falha ao carregar tarefas do novo projeto.'))
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Tarefa antiga')
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    expect((await screen.findByText('Falha ao carregar tarefas do novo projeto.')).textContent)
      .toBe('Falha ao carregar tarefas do novo projeto.')
    expect(screen.queryByText('Tarefa antiga')).toBeNull()
    expect(screen.queryByLabelText('Status da tarefa Tarefa antiga')).toBeNull()
  })

  it('fecha o editor e não atualiza tarefa do projeto anterior após a troca', async () => {
    listTasks.mockResolvedValueOnce([makeTask('t1', 'Layout')]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByText('Editar tarefa'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateTask).not.toHaveBeenCalled()
  })

  it('fecha a confirmação de exclusão do projeto anterior após a troca', async () => {
    listTasks.mockResolvedValueOnce([makeTask('t1', 'Layout')]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir tarefa Layout' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectTaskList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma tarefa cadastrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deleteTask).not.toHaveBeenCalled()
  })

  it('identifica o controle de edição pela tarefa', async () => {
    listTasks.mockResolvedValue([makeTask('t1', 'Layout')])
    render(<ProjectTaskList projectId="p1" onChanged={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Editar tarefa Layout' })).toBeTruthy()
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/projects/ProjectTaskList.test.tsx`
Expected: FAIL with module not found. Para a regressão de título vazio, a validação já existia no baseline; a prova controlada removeu temporariamente somente essa checagem, observou RED e a restaurou antes da implementação final.

- [ ] **Step 3: Implement the task list**

Create `src/components/projects/ProjectTaskList.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, ListTodo } from 'lucide-react'
import { calculateProjectProgress } from '../../lib/projectProgress'
import { useToast } from '../../hooks/useToast'
import {
  createTask, deleteTask, listTasks, reorderTasks, updateTask,
} from '../../services/projectTaskService'
import {
  TASK_STATUSES, type ProjectPriority, type ProjectTask, type ProjectTaskWrite, type TaskStatus,
} from '../../types/project'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { Textarea } from '../ui/Textarea'
import { formatProjectDate } from './ProjectCard'
import { PROJECT_PRIORITY_LABELS } from './ProjectPriorityBadge'

interface ProjectTaskListProps {
  projectId: string
  onChanged: () => void
  disabled?: boolean
}

interface TaskDraft {
  title: string
  description: string
  status: TaskStatus
  responsibleName: string
  startDate: string
  dueDate: string
  priority: ProjectPriority
  notes: string
}

type TaskDraftErrors = Partial<Record<keyof TaskDraft, string>>
type TaskLoadState =
  | { status: 'loading'; projectId: string }
  | { status: 'ready'; projectId: string; tasks: ProjectTask[] }
  | { status: 'error'; projectId: string; message: string; tasks: ProjectTask[] | null }

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada',
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function emptyDraft(): TaskDraft {
  return {
    title: '', description: '', status: 'pending', responsibleName: '',
    startDate: '', dueDate: '', priority: 'medium', notes: '',
  }
}

function draftFromTask(task: ProjectTask): TaskDraft {
  return {
    title: task.title, description: task.description ?? '', status: task.status,
    responsibleName: task.responsible_name ?? '', startDate: task.start_date ?? '',
    dueDate: task.due_date ?? '', priority: task.priority, notes: task.notes ?? '',
  }
}

function writeFromDraft(draft: TaskDraft): ProjectTaskWrite {
  return {
    title: draft.title.trim(), description: draft.description.trim(), status: draft.status,
    responsibleName: draft.responsibleName.trim(), startDate: draft.startDate || null,
    dueDate: draft.dueDate || null, priority: draft.priority, notes: draft.notes.trim(),
  }
}

function writeFromTask(task: ProjectTask, status = task.status): ProjectTaskWrite {
  return {
    title: task.title, description: task.description ?? '', status,
    responsibleName: task.responsible_name ?? '', startDate: task.start_date,
    dueDate: task.due_date, priority: task.priority, notes: task.notes ?? '',
  }
}

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value)
}

export function ProjectTaskList({ projectId, onChanged, disabled = false }: ProjectTaskListProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<TaskLoadState>({ status: 'loading', projectId })
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft)
  const [errors, setErrors] = useState<TaskDraftErrors>({})
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectTask | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const requestRef = useRef(0)
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId
  const loadStateRef = useRef(loadState)
  loadStateRef.current = loadState

  const reload = useCallback(async (background = false): Promise<void> => {
    const request = ++requestRef.current
    const previous = loadStateRef.current
    const retained = previous.projectId === projectId
      ? previous.status === 'ready'
        ? previous.tasks
        : previous.status === 'error' ? previous.tasks : null
      : null
    if (!background) setLoadState({ status: 'loading', projectId })
    try {
      const tasks = await listTasks(projectId)
      if (!mountedRef.current || request !== requestRef.current) return
      setLoadState({ status: 'ready', projectId, tasks })
    } catch (error) {
      if (!mountedRef.current || request !== requestRef.current) return
      setLoadState({
        status: 'error',
        projectId,
        message: errorMessage(error, 'Não foi possível carregar as tarefas. Tente novamente.'),
        tasks: retained,
      })
    }
  }, [projectId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    setLoadState({ status: 'loading', projectId })
    setFormOpen(false)
    setEditingTask(null)
    setDeleteCandidate(null)
    setDraft(emptyDraft())
    setErrors({})
    void reload()
  }, [reload])

  const stateBelongsToProject = loadState.projectId === projectId
  const currentTasks = stateBelongsToProject
    ? loadState.status === 'ready'
      ? loadState.tasks
      : loadState.status === 'error' ? loadState.tasks ?? [] : []
    : []
  const metrics = calculateProjectProgress(currentTasks)
  const actionsDisabled = disabled || saving

  const setField = <K extends keyof TaskDraft,>(key: K, value: TaskDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const perform = async (action: () => Promise<void>, success: string) => {
    if (savingRef.current || disabled) return
    savingRef.current = true
    setSaving(true)
    try {
      await action()
      if (!mountedRef.current || projectIdRef.current !== projectId) return
      toast(success)
      await reload(true)
      if (mountedRef.current && projectIdRef.current === projectId) onChanged()
    } catch (error) {
      if (mountedRef.current && projectIdRef.current === projectId) {
        toast(errorMessage(error, 'Não foi possível concluir a operação. Tente novamente.'), 'error')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingTask(null)
    setDraft(emptyDraft())
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (task: ProjectTask) => {
    if (task.project_id !== projectId) return
    setEditingTask(task)
    setDraft(draftFromTask(task))
    setErrors({})
    setFormOpen(true)
  }

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (actionsDisabled || (editingTask && editingTask.project_id !== projectId)) return
    const nextErrors: TaskDraftErrors = {}
    if (!draft.title.trim()) nextErrors.title = 'Informe o título da tarefa.'
    if (draft.startDate && draft.dueDate && draft.dueDate < draft.startDate) {
      nextErrors.dueDate = 'O prazo não pode anteceder o início.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    const payload = writeFromDraft(draft)
    void perform(async () => {
      if (editingTask) await updateTask(editingTask.id, payload)
      else await createTask(projectId, payload)
      setFormOpen(false)
      setEditingTask(null)
    }, editingTask ? 'Tarefa atualizada.' : 'Tarefa criada.')
  }

  const changeStatus = (task: ProjectTask, value: string) => {
    if (task.project_id !== projectId || !isTaskStatus(value) || value === task.status || actionsDisabled) return
    void perform(
      async () => { await updateTask(task.id, writeFromTask(task, value)) },
      'Status da tarefa atualizado.',
    )
  }

  const removeTask = async () => {
    if (!deleteCandidate || deleteCandidate.project_id !== projectId || actionsDisabled) return
    const id = deleteCandidate.id
    await perform(async () => {
      await deleteTask(id)
      setDeleteCandidate(null)
    }, 'Tarefa excluída.')
  }

  const moveTask = async (task: ProjectTask, direction: -1 | 1) => {
    if (task.project_id !== projectId || actionsDisabled) return
    const index = currentTasks.findIndex((item) => item.id === task.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= currentTasks.length) return
    const orderedIds = currentTasks.map((item) => item.id)
    const original = orderedIds[index]
    orderedIds[index] = orderedIds[target]
    orderedIds[target] = original
    await perform(async () => { await reorderTasks(projectId, orderedIds) }, 'Ordem das tarefas atualizada.')
  }

  if (!stateBelongsToProject || loadState.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <span className="sr-only">Carregando tarefas…</span>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Tarefas do projeto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Tarefas</h2>
          {loadState.status === 'ready' && (
            metrics.progressPercent === null
              ? <p className="text-sm text-muted">Sem tarefas ativas</p>
              : (
                <div className="mt-2 flex items-center gap-3">
                  <div
                    className="h-2 w-40 overflow-hidden rounded-full bg-elevated"
                    role="progressbar"
                    aria-label="Progresso de tarefas"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={metrics.progressPercent}
                  >
                    <div className="h-full bg-primary" style={{ width: `${metrics.progressPercent}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-ink">{metrics.progressPercent}%</span>
                </div>
              )
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={saving} onClick={() => void reload(true)}>Atualizar tarefas</Button>
          <Button type="button" variant="mint" disabled={actionsDisabled} onClick={openCreate}>Nova tarefa</Button>
        </div>
      </div>

      {disabled && (
        <p className="rounded-xl border border-line bg-elevated p-3 text-sm text-muted">
          Projeto cancelado: o histórico de tarefas permanece visível, mas as mutações estão desabilitadas.
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void reload(true)}>Tentar novamente</Button>
        </div>
      )}
      {loadState.status === 'ready' && currentTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa cadastrada."
          description="Crie tarefas para acompanhar a execução e calcular o progresso automaticamente."
        />
      ) : currentTasks.length > 0 && (
        <ol className="flex flex-col gap-3">
          {currentTasks.map((task, index) => (
            <li key={task.id} className="rounded-xl border border-line bg-surface p-4" aria-busy={saving}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{task.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {PROJECT_PRIORITY_LABELS[task.priority]} · Início {formatProjectDate(task.start_date)} · Prazo {formatProjectDate(task.due_date)}
                  </p>
                  {task.description && <p className="mt-2 text-sm text-ink">{task.description}</p>}
                  {task.notes && <p className="mt-2 text-sm text-muted">{task.notes}</p>}
                </div>
                <Select
                  label={`Status da tarefa ${task.title}`}
                  value={task.status}
                  options={TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] }))}
                  disabled={actionsDisabled || task.project_id !== projectId}
                  onChange={(event) => changeStatus(task, event.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" disabled={actionsDisabled || task.project_id !== projectId || index === 0} aria-label={`Mover tarefa ${task.title} para cima`} onClick={() => void moveTask(task, -1)}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" disabled={actionsDisabled || task.project_id !== projectId || index === currentTasks.length - 1} aria-label={`Mover tarefa ${task.title} para baixo`} onClick={() => void moveTask(task, 1)}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" disabled={actionsDisabled || task.project_id !== projectId} aria-label={`Editar tarefa ${task.title}`} onClick={() => openEdit(task)}>Editar tarefa</Button>
                <Button type="button" variant="danger" disabled={actionsDisabled || task.project_id !== projectId} aria-label={`Excluir tarefa ${task.title}`} onClick={() => setDeleteCandidate(task)}>Excluir</Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setEditingTask(null) } }}
        title={editingTask ? 'Editar tarefa' : 'Nova tarefa'}
        dismissible={!saving}
      >
        <form className="flex flex-col gap-4" onSubmit={submitTask} noValidate>
          <Input label="Título *" value={draft.title} error={errors.title} disabled={actionsDisabled} onChange={(event) => setField('title', event.target.value)} required />
          <Select label="Status" value={draft.status} options={TASK_STATUSES.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] }))} disabled={actionsDisabled} onChange={(event) => setField('status', event.target.value as TaskStatus)} />
          <Input label="Responsável" value={draft.responsibleName} disabled={actionsDisabled} onChange={(event) => setField('responsibleName', event.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Início" type="date" value={draft.startDate} disabled={actionsDisabled} onChange={(event) => setField('startDate', event.target.value)} />
            <Input label="Prazo" type="date" value={draft.dueDate} error={errors.dueDate} disabled={actionsDisabled} onChange={(event) => setField('dueDate', event.target.value)} />
          </div>
          <Select label="Prioridade" value={draft.priority} options={Object.entries(PROJECT_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} disabled={actionsDisabled} onChange={(event) => setField('priority', event.target.value as ProjectPriority)} />
          <Textarea label="Descrição" value={draft.description} disabled={actionsDisabled} onChange={(event) => setField('description', event.target.value)} rows={3} />
          <Textarea label="Notas" value={draft.notes} disabled={actionsDisabled} onChange={(event) => setField('notes', event.target.value)} rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={actionsDisabled} onClick={() => { setFormOpen(false); setEditingTask(null) }}>Cancelar</Button>
            <Button type="submit" variant="mint" loading={saving}>{editingTask ? 'Salvar tarefa' : 'Adicionar tarefa'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="Excluir tarefa"
        description={`Excluir tarefa ${deleteCandidate?.title ?? ''}? Esta ação não exclui o projeto.`}
        confirmLabel="Confirmar exclusão"
        loading={saving}
        onConfirm={() => void removeTask()}
        onCancel={() => { if (!saving) setDeleteCandidate(null) }}
      />
    </section>
  )
}
```

O payload de escrita é montado explicitamente a partir de `ProjectTaskWrite`; `completed_at` e `cancelled_at` nunca aparecem no frontend. A ordem enviada à RPC inclui todas as tarefas, e respostas de requests anteriores são descartadas por versão e montagem. O estado e os diálogos são isolados por projeto.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/components/projects/ProjectTaskList.test.tsx && npm run build`
Expected: PASS with 14 tests and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/ProjectTaskList.tsx src/components/projects/ProjectTaskList.test.tsx
git commit -m "feat: adicionar tarefas e progresso do projeto"
```

Se a implementação for separada da correção de isolamento, commitar a correção revisada com `fix: isolar tarefas e diálogos por projeto`.

---

### Task 10: Implementar revisões, aprovação e entrega

**Files:**
- Create: `src/components/projects/ProjectRevisionList.tsx`
- Create: `src/components/projects/ProjectRevisionList.test.tsx`
- Create: `src/components/projects/ProjectDeliveryPanel.tsx`
- Create: `src/components/projects/ProjectDeliveryPanel.test.tsx`

**Interfaces:**
- Consumes: revision service, `deliverProject`, `DeliveryInput`, `Project`.
- Produces: explicit approval and delivery actions with history feedback.

**Controller addendum — isolamento e imutabilidade:**
- O estado de carga de revisões carrega `projectId`; dados de outro projeto nunca são retidos em erro ou renderizados.
- Toda mutação de revisão verifica montagem, ID atual e `revision.project_id`; respostas obsoletas não emitem toast, recarregam nem chamam `onChanged`.
- O resultado persistido de create/edit/status/approval é aplicado localmente antes do reload; se o refresh falhar, a revisão aprovada permanece read-only.
- A entrega mantém um guard global de saving fora da subárvore visual keyed por `project.id`; rascunho, erros, confirmação e entrega salva são descartados sincronicamente na troca.
- A confirmação de entrega guarda snapshot `{ projectId, payload }` e usa somente esse payload; IDs diferentes do projeto atual são rejeitados.
- Revisão aprovada não oferece edição, status ou nova aprovação. Projeto cancelado preserva histórico e bloqueia mutações.
- URLs usam `type="text"` e `inputMode="url"`; o valor bruto deve ser HTTP(S) sem qualquer whitespace antes da normalização do payload.
- Escopo restrito a estes quatro arquivos; nenhuma alteração de serviço, schema, rota, dependência ou finanças.

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
// src/components/projects/ProjectRevisionList.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRevision } from '../../types/project'

const { listRevisions, createRevision, updateRevision } = vi.hoisted(() => ({
  listRevisions: vi.fn(), createRevision: vi.fn(), updateRevision: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectRevisionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectRevisionService')>()
  return { ...actual, listRevisions, createRevision, updateRevision }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectRevisionList } from './ProjectRevisionList'

function makeRevision(status: ProjectRevision['status'] = 'completed'): ProjectRevision {
  return {
    id: 'r1', owner_id: 'owner-1', project_id: 'p1', requested_at: '2026-11-25T12:00:00Z',
    description: 'Ajustar cores', responsible_name: null, status,
    completed_at: status === 'completed' || status === 'approved' ? '2026-11-25T12:30:00Z' : null,
    approved_at: status === 'approved' ? '2026-11-25T13:00:00Z' : null,
    notes: null, created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  }
}

afterEach(cleanup)

describe('ProjectRevisionList', () => {
  beforeEach(() => {
    listRevisions.mockReset().mockResolvedValue([])
    createRevision.mockReset()
    updateRevision.mockReset()
    toast.mockReset()
  })

  it('mostra vazio e permite registrar revisão', async () => {
    createRevision.mockResolvedValue(makeRevision('requested'))
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma revisão registrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Ajustar cores' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    await waitFor(() => expect(createRevision).toHaveBeenCalledWith('p1', expect.objectContaining({ description: 'Ajustar cores' })))
  })

  it('aprovação exige confirmação e não oferece delete', async () => {
    listRevisions.mockResolvedValue([makeRevision('completed')])
    updateRevision.mockResolvedValue({ ...makeRevision('completed'), status: 'approved', approved_at: '2026-11-25T13:00:00Z' })
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar revisão' }))
    expect(updateRevision).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar aprovação/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))
    await waitFor(() => expect(updateRevision).toHaveBeenCalledWith('r1', expect.objectContaining({ status: 'approved' })))
    expect(screen.queryByRole('button', { name: /Excluir revisão/ })).toBeNull()
    expect(updateRevision.mock.calls[0][1]).not.toHaveProperty('approved_at')
    expect(updateRevision.mock.calls[0][1]).not.toHaveProperty('completed_at')
  })

  it('preserva a aprovação local quando o refresh em background falha', async () => {
    const completed = makeRevision('completed')
    const approved = {
      ...completed, status: 'approved' as const,
      approved_at: '2026-11-25T13:00:00Z', updated_at: '2026-11-25T13:00:00Z',
    }
    listRevisions
      .mockResolvedValueOnce([completed])
      .mockRejectedValueOnce(new Error('Falha ao atualizar revisões.'))
    updateRevision.mockResolvedValue(approved)
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar revisão' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprovação' }))

    expect((await screen.findByText('Falha ao atualizar revisões.')).textContent).toBe('Falha ao atualizar revisões.')
    expect(screen.getByText('Aprovada')).toBeTruthy()
    expect(screen.getByText(/Aprovada em/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar revisão' })).toBeNull()
    expect(screen.queryByLabelText('Status da revisão')).toBeNull()
    expect(updateRevision).toHaveBeenCalledTimes(1)
  })

  it.each(['create', 'edit', 'status'] as const)('preserva o resultado local de %s quando o refresh falha', async (operation) => {
    const initial = makeRevision(operation === 'create' ? 'requested' : 'completed')
    const returned = {
      ...initial,
      id: operation === 'create' ? 'r-new' : initial.id,
      description: 'Revisão persistida',
      status: operation === 'status' ? 'in_progress' as const : initial.status,
      notes: 'Nota persistida',
    }
    listRevisions
      .mockResolvedValueOnce(operation === 'create' ? [] : [initial])
      .mockRejectedValueOnce(new Error('Falha ao atualizar revisões.'))
    const mutation = operation === 'create' ? createRevision : updateRevision
    mutation.mockResolvedValue(returned)
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)

    if (operation === 'create') {
      await screen.findByText('Nenhuma revisão registrada.')
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Descrição enviada' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    } else {
      await screen.findByText('Ajustar cores')
      if (operation === 'edit') {
        fireEvent.click(screen.getByRole('button', { name: 'Editar revisão' }))
        fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Descrição editada' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }))
      } else {
        fireEvent.change(screen.getByLabelText('Status da revisão'), { target: { value: 'in_progress' } })
      }
    }

    expect((await screen.findByText('Falha ao atualizar revisões.')).textContent).toBe('Falha ao atualizar revisões.')
    expect(screen.getByText('Revisão persistida')).toBeTruthy()
    expect(screen.getByText('Nota persistida')).toBeTruthy()
    expect((screen.getByLabelText('Status da revisão') as HTMLSelectElement).value).toBe(returned.status)
    expect(mutation).toHaveBeenCalledTimes(1)
  })

  it('revisão aprovada permanece read-only e edição não oferece approved', async () => {
    listRevisions.mockResolvedValue([makeRevision('approved')])
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Aprovada')
    expect(screen.queryByRole('button', { name: 'Editar revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar revisão' })).toBeNull()
    listRevisions.mockResolvedValue([makeRevision('requested')])
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar revisões' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Editar revisão' }))
    const select = screen.getByLabelText('Status da revisão em edição') as HTMLSelectElement
    expect(Array.from(select.options, (option) => option.value)).not.toContain('approved')
  })

  it('preserva histórico em erro e descarta resposta obsoleta', async () => {
    const old = deferred<ProjectRevision[]>()
    listRevisions.mockReturnValueOnce(old.promise).mockResolvedValueOnce([makeRevision()])
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Ajustar cores')
    listRevisions.mockRejectedValueOnce(new Error('Falha ao atualizar revisões.'))
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar revisões' }))
    expect((await screen.findByText('Falha ao atualizar revisões.')).textContent).toBe('Falha ao atualizar revisões.')
    expect(screen.getByText('Ajustar cores')).toBeTruthy()
    await act(async () => { old.resolve([{ ...makeRevision(), id: 'old', description: 'Revisão antiga' }]); await old.promise })
    expect(screen.queryByText('Revisão antiga')).toBeNull()
  })

  it('projeto cancelado mantém revisões e bloqueia criação e aprovação', async () => {
    listRevisions.mockResolvedValue([makeRevision('completed')])
    render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} disabled />)
    await screen.findByText('Ajustar cores')
    expect((screen.getByRole('button', { name: 'Nova revisão' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Aprovar revisão' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('não preserva revisões do projeto anterior quando a carga do novo projeto falha', async () => {
    listRevisions
      .mockResolvedValueOnce([makeRevision()])
      .mockRejectedValueOnce(new Error('Falha ao carregar revisões do novo projeto.'))
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    await screen.findByText('Ajustar cores')
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    expect(await screen.findByText('Falha ao carregar revisões do novo projeto.')).toBeTruthy()
    expect(screen.queryByText('Ajustar cores')).toBeNull()
  })

  it('fecha o editor de revisão do projeto anterior após a troca', async () => {
    listRevisions.mockResolvedValueOnce([makeRevision()]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar revisão' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma revisão registrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateRevision).not.toHaveBeenCalled()
  })

  it('fecha a aprovação de revisão do projeto anterior após a troca', async () => {
    listRevisions.mockResolvedValueOnce([makeRevision('completed')]).mockResolvedValueOnce([])
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar revisão' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<ProjectRevisionList projectId="p2" onChanged={vi.fn()} />)
    await screen.findByText('Nenhuma revisão registrada.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(updateRevision).not.toHaveBeenCalled()
  })

  it.each([
    { operation: 'create', outcome: 'resolve' },
    { operation: 'create', outcome: 'reject' },
    { operation: 'update', outcome: 'resolve' },
    { operation: 'update', outcome: 'reject' },
  ] as const)('descarta $operation de p1 $outcome após trocar para p2', async ({ operation, outcome }) => {
    const p1 = makeRevision('completed')
    const p2 = { ...makeRevision('completed'), id: 'r2', project_id: 'p2', description: 'Revisão do projeto p2' }
    listRevisions.mockResolvedValueOnce([p1]).mockResolvedValueOnce([p2])
    const pending = deferred<ProjectRevision>()
    const mutation = operation === 'create' ? createRevision : updateRevision
    mutation.mockReturnValueOnce(pending.promise)
    const onChanged = vi.fn()
    const { rerender } = render(<ProjectRevisionList projectId="p1" onChanged={onChanged} />)
    await screen.findByText('Ajustar cores')

    if (operation === 'create') {
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Nova revisão antiga' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Editar revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Edição antiga' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }))
    }
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1))

    rerender(<ProjectRevisionList projectId="p2" onChanged={onChanged} />)
    await screen.findByText('Revisão do projeto p2')
    const reloadCalls = listRevisions.mock.calls.length
    await act(async () => {
      if (outcome === 'resolve') {
        pending.resolve({ ...p1, id: operation === 'create' ? 'r-old' : p1.id, description: 'Revisão antiga' })
        await pending.promise
      } else {
        pending.reject(new Error('Falha na mutação anterior.'))
        await pending.promise.catch(() => undefined)
      }
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(listRevisions).toHaveBeenCalledTimes(reloadCalls)
    expect(screen.queryByText('Revisão antiga')).toBeNull()
    expect(screen.getByText('Revisão do projeto p2')).toBeTruthy()
  })

  it.each(['create', 'update'] as const)('descarta resposta de %s após desmontagem', async (operation) => {
    listRevisions.mockResolvedValueOnce(operation === 'create' ? [] : [makeRevision('completed')])
    const pending = deferred<ProjectRevision>()
    const mutation = operation === 'create' ? createRevision : updateRevision
    mutation.mockReturnValueOnce(pending.promise)
    const onChanged = vi.fn()
    const { unmount } = render(<ProjectRevisionList projectId="p1" onChanged={onChanged} />)

    if (operation === 'create') {
      await screen.findByText('Nenhuma revisão registrada.')
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Revisão pendente' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }))
    } else {
      await screen.findByText('Ajustar cores')
      fireEvent.click(screen.getByRole('button', { name: 'Editar revisão' }))
      fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Revisão pendente' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar revisão' }))
    }
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1))
    const reloadCalls = listRevisions.mock.calls.length
    unmount()

    await act(async () => {
      if (operation === 'create') {
        pending.resolve({ ...makeRevision('requested'), id: 'r-new', description: 'Revisão pendente' })
        await pending.promise
      } else {
        pending.reject(new Error('Falha após desmontagem.'))
        await pending.promise.catch(() => undefined)
      }
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
    expect(listRevisions).toHaveBeenCalledTimes(reloadCalls)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
```

```tsx
// @vitest-environment jsdom
// src/components/projects/ProjectDeliveryPanel.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../../types/project'

const { deliverProject } = vi.hoisted(() => ({ deliverProject: vi.fn() }))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/projectService')>()
  return { ...actual, deliverProject }
})
vi.mock('../../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})

import { ProjectDeliveryPanel } from './ProjectDeliveryPanel'

const project: Project = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1',
  source_link_id: null, name: 'Site', service: 'Site', contracted_value_cents: 100000,
  description: null, start_date: null, due_date: null, responsible_name: null,
  priority: 'high', status: 'completed', completed_at: '2026-11-25T12:00:00Z', delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null,
  archived_at: null, created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
}

afterEach(cleanup)

describe('ProjectDeliveryPanel', () => {
  beforeEach(() => {
    deliverProject.mockReset()
    toast.mockReset()
  })

  it('exige link de entrega e confirmação explícita', async () => {
    const onDelivered = vi.fn()
    render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe o link de entrega.')).textContent).toBe('Informe o link de entrega.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('envia links, notas e confirmação somente após ConfirmDialog', async () => {
    const delivered = {
      ...project, status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_confirmed_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega',
      files_url: 'https://example.test/arquivos', final_notes: 'Concluído',
    }
    deliverProject.mockResolvedValue(delivered)
    const onDelivered = vi.fn()
    render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/arquivos' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Concluído' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect(deliverProject).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar entrega/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(onDelivered).toHaveBeenCalledWith(delivered))
    expect(deliverProject).toHaveBeenCalledWith('p1', {
      deliveryUrl: 'https://example.test/entrega', filesUrl: 'https://example.test/arquivos',
      finalNotes: 'Concluído', confirmed: true,
    })
    expect(screen.getByRole('link', { name: 'Abrir entrega' }).getAttribute('href')).toBe('https://example.test/entrega')
    expect(screen.getByRole('link', { name: 'Abrir arquivos' }).getAttribute('href')).toBe('https://example.test/arquivos')
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.test/arquivo',
    'https://example.test/com espaco',
    ' https://example.test/entrega',
  ])('rejeita link de entrega inválido: %s', async (value) => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('rejeita link de arquivos com espaço', async () => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/com espaco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('preserva whitespace inicial em input de URL até a validação explícita', async () => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    const input = screen.getByLabelText('Link de entrega *') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.inputMode).toBe('url')
    fireEvent.change(input, { target: { value: ' https://example.test/entrega' } })
    expect(input.value).toBe(' https://example.test/entrega')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('preserva whitespace inicial no input de arquivos até a validação explícita', async () => {
    render(<ProjectDeliveryPanel project={project} onDelivered={vi.fn()} />)
    const input = screen.getByLabelText('Link dos arquivos') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.inputMode).toBe('url')
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(input, { target: { value: ' https://example.test/arquivos' } })
    expect(input.value).toBe(' https://example.test/arquivos')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect((await screen.findByText('Informe uma URL HTTP(S) válida.')).textContent).toBe('Informe uma URL HTTP(S) válida.')
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('não permite entregar projeto cancelado', () => {
    render(<ProjectDeliveryPanel project={{ ...project, status: 'cancelled' }} onDelivered={vi.fn()} />)
    expect(screen.getByText(/Entrega indisponível/).textContent).toMatch(/Entrega indisponível/)
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
    expect(deliverProject).not.toHaveBeenCalled()
  })

  it('exibe entrega persistida sem formulário ou seletor de status', () => {
    render(<ProjectDeliveryPanel project={{
      ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega', files_url: null, final_notes: 'Concluído',
    }} onDelivered={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Abrir entrega' })).toBeTruthy()
    expect(screen.getByText('Concluído').textContent).toBe('Concluído')
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('não confirma entrega anterior no primeiro commit da troca de projeto', () => {
    deliverProject.mockResolvedValue({
      ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega',
    })
    const onDelivered = vi.fn()
    const { rerender } = render(<SwitchProbe project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar entrega/)

    rerender(<SwitchProbe project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)

    expect(deliverProject).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Abrir entrega' })).toBeNull()
  })

  it('confirma o snapshot validado mesmo se o rascunho mudar com o diálogo aberto', async () => {
    const delivered = {
      ...project, status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega', files_url: 'https://example.test/arquivos',
      final_notes: 'Notas validadas',
    }
    deliverProject.mockResolvedValue(delivered)
    const onDelivered = vi.fn()
    render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.change(screen.getByLabelText('Link dos arquivos'), { target: { value: 'https://example.test/arquivos' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Notas validadas' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))

    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/alterado' } })
    fireEvent.change(screen.getByLabelText('Notas finais'), { target: { value: 'Notas alteradas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))

    await waitFor(() => expect(onDelivered).toHaveBeenCalledWith(delivered))
    expect(deliverProject).toHaveBeenCalledWith('p1', {
      deliveryUrl: 'https://example.test/entrega', filesUrl: 'https://example.test/arquivos',
      finalNotes: 'Notas validadas', confirmed: true,
    })
  })

  it('mantém a guarda global de saving bloqueada até a entrega anterior terminar', async () => {
    const pending = deferred<Project>()
    const deliveredP2 = {
      ...project, id: 'p2', status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega-p2',
    }
    deliverProject.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(deliveredP2)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p1' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))

    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    const submitP2 = screen.getByRole('button', { name: /Registrar entrega/ }) as HTMLButtonElement
    expect(submitP2.disabled).toBe(true)
    fireEvent.click(submitP2)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deliverProject).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({
        ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
        delivery_url: 'https://example.test/entrega-p1',
      })
      await pending.promise
    })
    await waitFor(() => expect(submitP2.disabled).toBe(false))

    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p2' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(submitP2)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(2))
    expect(deliverProject).toHaveBeenLastCalledWith('p2', {
      deliveryUrl: 'https://example.test/entrega-p2', filesUrl: '', finalNotes: '', confirmed: true,
    })
  })

  it('descarta entrega do projeto anterior e fecha a confirmação após a troca', async () => {
    const pending = deferred<Project>()
    deliverProject.mockReturnValueOnce(pending.promise)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledWith('p1', expect.any(Object)))
    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      pending.resolve({ ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z', delivery_url: 'https://example.test/entrega' })
      await pending.promise
    })
    expect(onDelivered).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Abrir entrega' })).toBeNull()
  })

  it('descarta erro de entrega anterior após a troca de projeto', async () => {
    const pending = deferred<Project>()
    deliverProject.mockReturnValueOnce(pending.promise)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p1' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))

    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    await act(async () => {
      pending.reject(new Error('Falha na entrega anterior.'))
      await pending.promise.catch(() => undefined)
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onDelivered).not.toHaveBeenCalled()
    expect(screen.queryByText('Falha na entrega anterior.')).toBeNull()
    expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('libera a guarda global após rejeição e permite entregar o projeto atual', async () => {
    const pending = deferred<Project>()
    const deliveredP2 = {
      ...project, id: 'p2', status: 'delivered' as const, delivered_at: '2026-11-26T12:00:00Z',
      delivery_url: 'https://example.test/entrega-p2',
    }
    deliverProject.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(deliveredP2)
    const onDelivered = vi.fn()
    const { rerender } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p1' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))

    rerender(<ProjectDeliveryPanel project={{ ...project, id: 'p2', name: 'Outro projeto' }} onDelivered={onDelivered} />)
    expect((screen.getByRole('button', { name: /Registrar entrega/ }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      pending.reject(new Error('Falha na entrega anterior.'))
      await pending.promise.catch(() => undefined)
    })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false))

    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega-p2' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(2))
    expect(deliverProject).toHaveBeenLastCalledWith('p2', {
      deliveryUrl: 'https://example.test/entrega-p2', filesUrl: '', finalNotes: '', confirmed: true,
    })
  })

  it.each(['resolve', 'reject'] as const)('descarta resposta de entrega após desmontagem: %s', async (outcome) => {
    const pending = deferred<Project>()
    deliverProject.mockReturnValueOnce(pending.promise)
    const onDelivered = vi.fn()
    const { unmount } = render(<ProjectDeliveryPanel project={project} onDelivered={onDelivered} />)
    fireEvent.change(screen.getByLabelText('Link de entrega *'), { target: { value: 'https://example.test/entrega' } })
    fireEvent.click(screen.getByLabelText('Entrega confirmada com o cliente'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    await waitFor(() => expect(deliverProject).toHaveBeenCalledTimes(1))
    unmount()
    render(<ProjectDeliveryPanel project={{ ...project, id: 'p2' }} onDelivered={onDelivered} />)
    expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      if (outcome === 'resolve') {
        pending.resolve({
          ...project, status: 'delivered', delivered_at: '2026-11-26T12:00:00Z',
          delivery_url: 'https://example.test/entrega',
        })
        await pending.promise
      } else {
        pending.reject(new Error('Falha após desmontagem.'))
        await pending.promise.catch(() => undefined)
      }
    })

    expect(toast).not.toHaveBeenCalled()
    expect(onDelivered).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Registrar entrega' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

function SwitchProbe({ project: currentProject, onDelivered }: {
  project: Project
  onDelivered: (project: Project) => void
}) {
  useLayoutEffect(() => {
    if (currentProject.id !== 'p2') return
    screen.queryByRole('button', { name: 'Confirmar entrega' })?.click()
  }, [currentProject.id])
  return <ProjectDeliveryPanel project={currentProject} onDelivered={onDelivered} />
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/projects/ProjectRevisionList.test.tsx src/components/projects/ProjectDeliveryPanel.test.tsx`
Expected: FAIL with modules not found on the initial scaffold.

Este RED de módulo ausente prova somente o scaffolding. A aprovação da task exige também RED/GREEN comportamental das regressões de isolamento e aprovação, mais provas controladas por mutação das famílias de retenção entre projetos, reset de diálogos, supressão de mutação obsoleta, defesas de revisão aprovada, entrega cancelada e URL com whitespace. Nenhuma mutação temporária pode entrar em commit.

- [ ] **Step 3: Implement revisions and delivery**

Create `src/components/projects/ProjectRevisionList.tsx`:

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import {
  createRevision, listRevisions, updateRevision,
} from '../../services/projectRevisionService'
import {
  REVISION_STATUSES, type ProjectRevision, type ProjectRevisionWrite, type RevisionStatus,
} from '../../types/project'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Skeleton } from '../ui/Skeleton'
import { Textarea } from '../ui/Textarea'

interface ProjectRevisionListProps {
  projectId: string
  onChanged: () => void
  disabled?: boolean
}

interface RevisionDraft {
  description: string
  responsibleName: string
  status: RevisionStatus
  notes: string
}

type RevisionLoadState =
  | { status: 'loading'; projectId: string }
  | { status: 'ready'; projectId: string; revisions: ProjectRevision[] }
  | { status: 'error'; projectId: string; message: string; revisions: ProjectRevision[] | null }

const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  requested: 'Solicitada', in_progress: 'Em andamento', completed: 'Concluída', approved: 'Aprovada',
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function emptyDraft(): RevisionDraft {
  return { description: '', responsibleName: '', status: 'requested', notes: '' }
}

function writeFromRevision(revision: ProjectRevision, status = revision.status): ProjectRevisionWrite {
  return {
    description: revision.description, responsibleName: revision.responsible_name ?? '',
    status, notes: revision.notes ?? '',
  }
}

function writeFromDraft(draft: RevisionDraft): ProjectRevisionWrite {
  return {
    description: draft.description.trim(), responsibleName: draft.responsibleName.trim(),
    status: draft.status, notes: draft.notes.trim(),
  }
}

function upsertRevision(revisions: ProjectRevision[], revision: ProjectRevision): ProjectRevision[] {
  return revisions.some((current) => current.id === revision.id)
    ? revisions.map((current) => current.id === revision.id ? revision : current)
    : [revision, ...revisions]
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Não definido'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
  }).format(date)
}

function isRevisionStatus(value: string): value is RevisionStatus {
  return (REVISION_STATUSES as readonly string[]).includes(value)
}

export function ProjectRevisionList({ projectId, onChanged, disabled = false }: ProjectRevisionListProps) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<RevisionLoadState>({ status: 'loading', projectId })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectRevision | null>(null)
  const [draft, setDraft] = useState<RevisionDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState<ProjectRevision | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(false)
  const requestRef = useRef(0)
  const projectIdRef = useRef(projectId)

  useLayoutEffect(() => {
    mountedRef.current = true
    projectIdRef.current = projectId
    return () => { mountedRef.current = false }
  }, [projectId])

  const reload = useCallback(async (background = false, mutated?: ProjectRevision): Promise<void> => {
    const request = ++requestRef.current
    if (!background) {
      setLoadState((previous) => previous.projectId === projectId
        ? { status: 'loading', projectId }
        : previous)
    }
    try {
      const revisions = await listRevisions(projectId)
      if (!mountedRef.current || projectIdRef.current !== projectId || request !== requestRef.current) return
      setLoadState({ status: 'ready', projectId, revisions })
    } catch (cause) {
      if (!mountedRef.current || projectIdRef.current !== projectId || request !== requestRef.current) return
      const message = errorMessage(cause, 'Não foi possível carregar as revisões. Tente novamente.')
      setLoadState((previous) => {
        const retained = previous.projectId === projectId
          ? previous.status === 'ready'
            ? previous.revisions
            : previous.status === 'error' ? previous.revisions : null
          : null
        return {
          status: 'error', projectId, message,
          revisions: mutated ? upsertRevision(retained ?? [], mutated) : retained,
        }
      })
    }
  }, [projectId])

  useEffect(() => {
    setFormOpen(false)
    setEditing(null)
    setApproving(null)
    setDraft(emptyDraft())
    setError(null)
    void reload()
  }, [reload])

  const stateBelongsToProject = loadState.projectId === projectId
  const currentRevisions = stateBelongsToProject
    ? loadState.status === 'ready'
      ? loadState.revisions
      : loadState.status === 'error' ? loadState.revisions ?? [] : []
    : []
  const actionsDisabled = disabled || saving

  const perform = async (
    action: () => Promise<ProjectRevision>,
    success: string,
    onSuccess?: () => void,
  ) => {
    if (savingRef.current || disabled) return
    savingRef.current = true
    setSaving(true)
    try {
      const updated = await action()
      if (!mountedRef.current || projectIdRef.current !== projectId) return
      setLoadState((previous) => {
        if (previous.projectId !== projectId) return previous
        const retained = previous.status === 'ready'
          ? previous.revisions
          : previous.status === 'error' ? previous.revisions ?? [] : []
        return { status: 'ready', projectId, revisions: upsertRevision(retained, updated) }
      })
      onSuccess?.()
      toast(success)
      await reload(true, updated)
      if (mountedRef.current && projectIdRef.current === projectId) onChanged()
    } catch (cause) {
      if (mountedRef.current && projectIdRef.current === projectId) {
        toast(errorMessage(cause, 'Não foi possível concluir a operação. Tente novamente.'), 'error')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  const openCreate = () => {
    if (actionsDisabled) return
    setEditing(null)
    setDraft(emptyDraft())
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (revision: ProjectRevision) => {
    if (actionsDisabled || revision.project_id !== projectId || revision.status === 'approved') return
    setEditing(revision)
    setDraft({
      description: revision.description, responsibleName: revision.responsible_name ?? '',
      status: revision.status, notes: revision.notes ?? '',
    })
    setError(null)
    setFormOpen(true)
  }

  const requestApproval = (revision: ProjectRevision) => {
    if (actionsDisabled || revision.project_id !== projectId || revision.status !== 'completed') return
    setError(null)
    setApproving(revision)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (actionsDisabled || draft.status === 'approved') return
    if (editing && (editing.project_id !== projectId || editing.status === 'approved')) return
    if (!draft.description.trim()) {
      setError('Informe a descrição da revisão.')
      return
    }
    setError(null)
    const payload = writeFromDraft(draft)
    void perform(
      async () => editing
        ? updateRevision(editing.id, payload)
        : createRevision(projectId, payload),
      editing ? 'Revisão atualizada.' : 'Revisão registrada.',
      () => { setFormOpen(false); setEditing(null) },
    )
  }

  const changeStatus = (revision: ProjectRevision, value: string) => {
    if (
      revision.project_id !== projectId || revision.status === 'approved'
      || !isRevisionStatus(value) || value === 'approved' || value === revision.status || actionsDisabled
    ) return
    void perform(
      async () => updateRevision(revision.id, writeFromRevision(revision, value)),
      'Status da revisão atualizado.',
    )
  }

  const approve = async () => {
    if (!approving || actionsDisabled || approving.project_id !== projectId || approving.status !== 'completed') return
    const revision = approving
    await perform(
      async () => updateRevision(revision.id, writeFromRevision(revision, 'approved')),
      'Revisão aprovada.',
      () => setApproving(null),
    )
  }

  if (!stateBelongsToProject || loadState.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-32" /><Skeleton className="h-32" />
        <span className="sr-only">Carregando revisões…</span>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Revisões do projeto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Revisões</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={saving} onClick={() => void reload(true)}>Atualizar revisões</Button>
          <Button type="button" variant="mint" disabled={actionsDisabled} onClick={openCreate}>Nova revisão</Button>
        </div>
      </div>
      {disabled && (
        <p className="rounded-xl border border-line bg-elevated p-3 text-sm text-muted">
          Projeto cancelado: o histórico de revisões permanece visível, mas novas revisões e aprovações estão desabilitadas.
        </p>
      )}
      {loadState.status === 'error' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void reload(true)}>Tentar novamente</Button>
        </div>
      )}
      {loadState.status === 'ready' && currentRevisions.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nenhuma revisão registrada."
          description="Registre ajustes solicitados pelo cliente e aprove cada revisão explicitamente."
        />
      ) : currentRevisions.map((revision) => (
        <Card key={revision.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-ink">{revision.description}</p>
              <p className="mt-1 text-xs text-muted">
                Solicitada em {formatDateTime(revision.requested_at)}
                {revision.responsible_name ? ` · ${revision.responsible_name}` : ''}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-elevated px-2.5 py-1 text-xs font-medium text-ink">
              {REVISION_STATUS_LABELS[revision.status]}
            </span>
          </div>
          {revision.status === 'approved' ? (
            <p className="text-xs text-muted">Aprovada em {formatDateTime(revision.approved_at)} · revisão bloqueada para edição.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Status da revisão"
                value={revision.status}
                options={REVISION_STATUSES.filter((status) => status !== 'approved').map((status) => ({
                  value: status, label: REVISION_STATUS_LABELS[status],
                }))}
                disabled={actionsDisabled || revision.project_id !== projectId}
                onChange={(event) => changeStatus(revision, event.target.value)}
              />
              <Button type="button" variant="outline" disabled={actionsDisabled || revision.project_id !== projectId} onClick={() => openEdit(revision)}>Editar revisão</Button>
              {revision.status === 'completed' && (
                <Button type="button" variant="mint" disabled={actionsDisabled || revision.project_id !== projectId} onClick={() => requestApproval(revision)}>Aprovar revisão</Button>
              )}
            </div>
          )}
          {revision.notes && <p className="text-sm text-muted">{revision.notes}</p>}
          {revision.completed_at && revision.status !== 'approved' && (
            <p className="text-xs text-muted">Concluída em {formatDateTime(revision.completed_at)}</p>
          )}
        </Card>
      ))}

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) { setFormOpen(false); setEditing(null) } }}
        title={editing ? 'Editar revisão' : 'Nova revisão'}
        dismissible={!saving}
      >
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <Textarea label="Descrição *" value={draft.description} error={error ?? undefined} disabled={actionsDisabled} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required rows={3} />
          <Input label="Responsável" value={draft.responsibleName} disabled={actionsDisabled} onChange={(event) => setDraft((current) => ({ ...current, responsibleName: event.target.value }))} />
          <Select
            label="Status da revisão em edição"
            value={draft.status}
            options={REVISION_STATUSES.filter((status) => status !== 'approved').map((status) => ({ value: status, label: REVISION_STATUS_LABELS[status] }))}
            disabled={actionsDisabled}
            onChange={(event) => {
              const status = event.target.value
              if (isRevisionStatus(status) && status !== 'approved') {
                setDraft((current) => ({ ...current, status }))
              }
            }}
          />
          <Textarea label="Notas" value={draft.notes} disabled={actionsDisabled} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={actionsDisabled} onClick={() => { setFormOpen(false); setEditing(null) }}>Cancelar</Button>
            <Button type="submit" variant="mint" loading={saving}>{editing ? 'Salvar revisão' : 'Registrar revisão'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(approving)}
        title="Confirmar aprovação"
        description={`Aprovar a revisão “${approving?.description ?? ''}”? A revisão aprovada ficará bloqueada para edição.`}
        confirmLabel="Confirmar aprovação"
        loading={saving}
        onConfirm={() => void approve()}
        onCancel={() => { if (!saving) setApproving(null) }}
      />
    </section>
  )
}
```

Create `src/components/projects/ProjectDeliveryPanel.tsx`:

```tsx
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { PackageCheck } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { deliverProject } from '../../services/projectService'
import type { DeliveryInput, Project } from '../../types/project'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'

interface ProjectDeliveryPanelProps {
  project: Project
  onDelivered: (project: Project) => void
}

interface DeliveryDraft {
  deliveryUrl: string
  filesUrl: string
  finalNotes: string
  confirmed: boolean
}

type DeliveryErrors = Partial<Record<'deliveryUrl' | 'filesUrl' | 'confirmed', string>>

interface DeliveryConfirmation {
  projectId: string
  payload: DeliveryInput
}

interface ProjectDeliveryContentProps extends ProjectDeliveryPanelProps {
  saving: boolean
  onStartSaving: () => boolean
  onSavingComplete: () => void
}

function isHttpUrl(value: string): boolean {
  if (/\s/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Não definido'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
  }).format(date)
}

function SafeLink({ href, label }: { href: string; label: string }) {
  return isHttpUrl(href)
    ? <a className="font-medium text-primary hover:underline" href={href} target="_blank" rel="noreferrer">{label}</a>
    : <span className="text-sm text-danger">URL inválida no histórico</span>
}

export function ProjectDeliveryPanel({ project, onDelivered }: ProjectDeliveryPanelProps) {
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(false)

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const startSaving = () => {
    if (savingRef.current) return false
    savingRef.current = true
    setSaving(true)
    return true
  }

  const completeSaving = () => {
    savingRef.current = false
    if (mountedRef.current) setSaving(false)
  }

  return (
    <ProjectDeliveryContent
      key={project.id}
      project={project}
      onDelivered={onDelivered}
      saving={saving}
      onStartSaving={startSaving}
      onSavingComplete={completeSaving}
    />
  )
}

function ProjectDeliveryContent({
  project, onDelivered, saving, onStartSaving, onSavingComplete,
}: ProjectDeliveryContentProps) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<DeliveryDraft>({
    deliveryUrl: project.delivery_url ?? '', filesUrl: project.files_url ?? '',
    finalNotes: project.final_notes ?? '', confirmed: false,
  })
  const [errors, setErrors] = useState<DeliveryErrors>({})
  const [confirmation, setConfirmation] = useState<DeliveryConfirmation | null>(null)
  const [savedDelivery, setSavedDelivery] = useState<Project | null>(null)
  const mountedRef = useRef(false)

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const delivered = savedDelivery?.id === project.id
    ? savedDelivery
    : project.status === 'delivered' ? project : null
  if (project.status === 'cancelled') {
    return (
      <Card>
        <h2 className="font-display text-lg font-bold text-ink">Entrega</h2>
        <p className="mt-2 text-sm text-muted">Entrega indisponível para projetos cancelados. O histórico existente permanece preservado.</p>
      </Card>
    )
  }
  if (delivered) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-ink">Entrega registrada</h2>
        </div>
        <p className="text-sm text-muted">Entregue em {formatDateTime(delivered.delivered_at)}</p>
        <div className="flex flex-wrap gap-4">
          {delivered.delivery_url && <SafeLink href={delivered.delivery_url} label="Abrir entrega" />}
          {delivered.files_url && <SafeLink href={delivered.files_url} label="Abrir arquivos" />}
        </div>
        {delivered.final_notes && <p className="text-sm text-ink">{delivered.final_notes}</p>}
        <p className="text-xs text-muted">Este registro não altera contrato, pagamento ou receita.</p>
      </Card>
    )
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || project.status === 'cancelled') return
    const next: DeliveryErrors = {}
    if (!draft.deliveryUrl) next.deliveryUrl = 'Informe o link de entrega.'
    else if (!isHttpUrl(draft.deliveryUrl)) next.deliveryUrl = 'Informe uma URL HTTP(S) válida.'
    if (draft.filesUrl && !isHttpUrl(draft.filesUrl)) next.filesUrl = 'Informe uma URL HTTP(S) válida.'
    if (!draft.confirmed) next.confirmed = 'Confirme a entrega com o cliente.'
    setErrors(next)
    if (Object.keys(next).length === 0) {
      setConfirmation({
        projectId: project.id,
        payload: {
          deliveryUrl: draft.deliveryUrl.trim(), filesUrl: draft.filesUrl.trim(),
          finalNotes: draft.finalNotes.trim(), confirmed: true,
        },
      })
    }
  }

  const confirmDelivery = async () => {
    const snapshot = confirmation
    if (
      !snapshot || snapshot.projectId !== project.id || project.status === 'cancelled'
      || !onStartSaving()
    ) return
    try {
      const saved = await deliverProject(snapshot.projectId, snapshot.payload)
      if (!mountedRef.current) return
      setSavedDelivery(saved)
      setConfirmation(null)
      onDelivered(saved)
      toast('Entrega registrada com sucesso.')
    } catch (cause) {
      if (mountedRef.current) {
        toast(cause instanceof Error && cause.message ? cause.message : 'Não foi possível registrar a entrega.', 'error')
      }
    } finally {
      onSavingComplete()
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Registrar entrega</h2>
        <p className="mt-1 text-sm text-muted">A entrega é explícita e não cria receita nem altera pagamentos.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Input label="Link de entrega *" type="text" inputMode="url" value={draft.deliveryUrl} error={errors.deliveryUrl} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, deliveryUrl: event.target.value })); setErrors((current) => ({ ...current, deliveryUrl: undefined })) }} required />
        <Input label="Link dos arquivos" type="text" inputMode="url" value={draft.filesUrl} error={errors.filesUrl} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, filesUrl: event.target.value })); setErrors((current) => ({ ...current, filesUrl: undefined })) }} />
        <Textarea label="Notas finais" value={draft.finalNotes} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, finalNotes: event.target.value }))} rows={3} />
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={draft.confirmed} disabled={saving} onChange={(event) => { setDraft((current) => ({ ...current, confirmed: event.target.checked })); setErrors((current) => ({ ...current, confirmed: undefined })) }} />
          Entrega confirmada com o cliente
        </label>
        {errors.confirmed && <p className="text-sm text-danger">{errors.confirmed}</p>}
        <div><Button type="submit" variant="mint" loading={saving}>Registrar entrega</Button></div>
      </form>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title="Confirmar entrega"
        description="Confirmar a entrega deste projeto? Esta ação registra os links e não altera contrato, pagamento ou receita."
        confirmLabel="Confirmar entrega"
        loading={saving}
        onConfirm={() => void confirmDelivery()}
        onCancel={() => { if (!saving) setConfirmation(null) }}
      />
    </Card>
  )
}
```

Nenhum módulo financeiro é importado. `approved_at`, `completed_at` e os timestamps de entrega são somente leitura; as escritas usam exclusivamente `ProjectRevisionWrite` e `DeliveryInput`. A aprovação e a entrega não alteram contrato, pagamento ou receita.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/components/projects/ProjectRevisionList.test.tsx src/components/projects/ProjectDeliveryPanel.test.tsx && npm run build`
Expected: PASS with 37/37 focused tests and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/ProjectRevisionList.tsx src/components/projects/ProjectRevisionList.test.tsx src/components/projects/ProjectDeliveryPanel.tsx src/components/projects/ProjectDeliveryPanel.test.tsx
git commit -m "feat: adicionar revisoes e entrega de projeto"
```

---

### Task 11: Criar página de detalhe do projeto

**Files:**
- Create: `src/pages/ProjectDetailPage.tsx`
- Create: `src/pages/ProjectDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getProject`, `ProjectForm`, `ProjectTaskList`, `ProjectRevisionList`, `ProjectDeliveryPanel`, `ProjectStatusBadge`.
- Produces: tabs “Visão”, “Tarefas”, “Revisões”, “Entrega” and “Histórico”.

**Controller addendum — prioridade sobre o trecho literal:**

- O escopo continua restrito a `src/pages/ProjectDetailPage.tsx` e `src/pages/ProjectDetailPage.test.tsx`.
- Preserve os testes e os comportamentos canônicos abaixo, mas implemente a página externa com `ProjectDetailContent key={id}`.
- Não escreva refs durante render. Prefira `useLayoutEffect` para identidade de montagem e atualização funcional para reter o último projeto válido em erro de refresh.
- A resposta de status e o `finally` da mutação continuam vinculados à instância/request da rota.
- Mantenha os textos, labels, tabs, campos, confirmações e chamadas de serviço do brief.
- Escreva os testes primeiro, execute o RED esperado, implemente o mínimo para GREEN e registre os comandos/resultados no relatório. Não faça push nem dispare subagentes.

- [ ] **Step 1: Write failing tests**

```tsx
// @vitest-environment jsdom
// src/pages/ProjectDetailPage.test.tsx
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetail } from '../types/project'

const { getProject, updateProject, setProjectStatus, deliverProject, listProjectFormOptions } = vi.hoisted(() => ({
  getProject: vi.fn(), updateProject: vi.fn(), setProjectStatus: vi.fn(), deliverProject: vi.fn(), listProjectFormOptions: vi.fn(),
}))
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
const { listTasks } = vi.hoisted(() => ({ listTasks: vi.fn() }))
const { listRevisions } = vi.hoisted(() => ({ listRevisions: vi.fn() }))
vi.mock('../services/projectService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectService')>()
  return { ...actual, getProject, updateProject, setProjectStatus, deliverProject, listProjectFormOptions }
})
vi.mock('../hooks/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useToast')>()
  return { ...actual, useToast: () => ({ toast }) }
})
vi.mock('../services/projectTaskService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectTaskService')>()
  return { ...actual, listTasks }
})
vi.mock('../services/projectRevisionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectRevisionService')>()
  return { ...actual, listRevisions }
})

import { ProjectDetailPage } from './ProjectDetailPage'

const project: ProjectDetail = {
  id: 'p1', owner_id: 'owner-1', client_id: 'client-1', contract_id: 'contract-1', source_link_id: null,
  name: 'Site da Empresa', client_name: 'Empresa A', service: 'Site', contracted_value_cents: 123456,
  description: null, start_date: '2026-11-25', due_date: '2026-12-10', responsible_name: null,
  priority: 'high', status: 'in_development', completed_at: null, delivered_at: null,
  delivery_confirmed_at: null, delivery_url: null, files_url: null, final_notes: null, archived_at: null,
  created_at: '2026-11-25T12:00:00Z', updated_at: '2026-11-25T12:00:00Z',
  progressPercent: 50, activeTasks: 2, completedTasks: 1, tasks: [], revisions: [], activities: [],
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/projetos/p1']}><Routes><Route path="/projetos/:id" element={<ProjectDetailPage />} /></Routes></MemoryRouter>)
}

function renderNavigablePage() {
  return render(
    <MemoryRouter initialEntries={['/projetos/p1']}>
      <Routes>
        <Route path="/projetos/:id" element={<><ProjectDetailPage /><RouteNavigator /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

function RouteNavigator() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/projetos/p2')}>Abrir p2</button>
}

afterEach(cleanup)

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    getProject.mockReset().mockResolvedValue(project)
    updateProject.mockReset()
    setProjectStatus.mockReset()
    deliverProject.mockReset()
    listProjectFormOptions.mockReset().mockResolvedValue({
      clients: [{ id: 'client-1', name: 'Empresa A' }],
      contracts: [{
        id: 'contract-1', client_id: 'client-1', service: 'Site', total_value_cents: 123456,
        allocated_cents: 123456, remaining_cents: 0, due_date: '2026-12-10',
      }],
    })
    toast.mockReset()
    listTasks.mockReset().mockResolvedValue([])
    listRevisions.mockReset().mockResolvedValue([])
  })

  it('mostra dados, progresso e valor alocado sem receita', async () => {
    renderPage()
    expect((await screen.findByRole('heading', { name: 'Site da Empresa' })).textContent).toBe('Site da Empresa')
    expect(screen.getByText('50%').textContent).toBe('50%')
    expect(screen.getByText('1 de 2 tarefas concluídas').textContent).toBe('1 de 2 tarefas concluídas')
    expect(screen.getByText('R$ 1.234,56').textContent?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56')
    expect(screen.queryByText(/recebido/i)).toBeNull()
  })

  it('renderiza tarefas e revisões nas abas com serviços filhos mockados e uma única ação por estado vazio', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Tarefas' }))
    expect((await screen.findByText('Nenhuma tarefa cadastrada.')).textContent).toBe('Nenhuma tarefa cadastrada.')
    expect(screen.getAllByRole('button', { name: 'Nova tarefa' })).toHaveLength(1)
    expect(listTasks).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByRole('tab', { name: 'Revisões' }))
    expect((await screen.findByText('Nenhuma revisão registrada.')).textContent).toBe('Nenhuma revisão registrada.')
    expect(screen.getAllByRole('button', { name: 'Nova revisão' })).toHaveLength(1)
    expect(listRevisions).toHaveBeenCalledWith('p1')
  })

  it('mostra histórico do projeto sem copiar eventos', async () => {
    getProject.mockResolvedValue({
      ...project,
      activities: [{
        id: 'a1', owner_id: 'owner-1', client_id: 'client-1', project_id: 'p1', contract_id: 'contract-1',
        type: 'status_change', description: 'Projeto em desenvolvimento.', metadata: {},
        created_by: 'owner-1', created_at: '2026-11-25T10:00:00Z',
      }],
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: 'Histórico' }))
    expect((await screen.findByText('Projeto em desenvolvimento.')).textContent).toBe('Projeto em desenvolvimento.')
  })

  it('refresh em erro preserva o último projeto válido', async () => {
    getProject.mockResolvedValueOnce(project).mockRejectedValueOnce(new Error('Falha ao atualizar.'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }))
    expect((await screen.findByText('Falha ao atualizar.')).textContent).toBe('Falha ao atualizar.')
    expect(screen.getByRole('heading', { name: 'Site da Empresa' }).textContent).toBe('Site da Empresa')
  })

  it('preserva o snapshot durante o refresh e aplica a resposta confirmada', async () => {
    const refresh = deferred<ProjectDetail | null>()
    getProject.mockResolvedValueOnce(project).mockReturnValueOnce(refresh.promise)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Atualizar' }))
    expect(screen.getByRole('heading', { name: 'Site da Empresa' })).toBeTruthy()
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
    await act(async () => {
      refresh.resolve({ ...project, name: 'Site atualizado' })
      await refresh.promise
    })
    expect((await screen.findByRole('heading', { name: 'Site atualizado' })).textContent).toBe('Site atualizado')
  })

  it('projeto entregue não oferece seletor de status', async () => {
    getProject.mockResolvedValue({ ...project, status: 'delivered' })
    renderPage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })
    expect(screen.queryByLabelText('Status do projeto')).toBeNull()
  })

  it('mudança de status exige ConfirmDialog antes da RPC', async () => {
    setProjectStatus.mockResolvedValue({ ...project, status: 'completed' })
    renderPage()
    fireEvent.change(await screen.findByLabelText('Status do projeto'), { target: { value: 'completed' } })
    expect(setProjectStatus).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toMatch(/Confirmar status/)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'completed'))
  })

  it('edição retorna Project e atualiza o detalhe completo', async () => {
    updateProject.mockResolvedValue({ ...project, name: 'Site atualizado' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar projeto' }))
    const nameInput = await screen.findByLabelText('Nome do projeto *')
    expect(screen.queryByText('Carregando formulário de projeto…')).toBeNull()
    fireEvent.change(nameInput, { target: { value: 'Site atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Site atualizado' })))
    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2))
  })

  it('projeto cancelado preserva tarefas e revisões sem permitir criações', async () => {
    getProject.mockResolvedValue({ ...project, status: 'cancelled' })
    renderPage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })
    expect(screen.queryByRole('button', { name: 'Editar projeto' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))
    await screen.findByText('Nenhuma tarefa cadastrada.')
    expect((screen.getByRole('button', { name: 'Nova tarefa' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Revisões' }))
    await screen.findByText('Nenhuma revisão registrada.')
    expect((screen.getByRole('button', { name: 'Nova revisão' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }))
    expect(screen.getByText('Nenhuma atividade registrada.')).toBeTruthy()
  })

  it('mostra ausência real com link de volta e descarta resposta de rota antiga', async () => {
    getProject.mockResolvedValueOnce(null)
    const missing = renderPage()
    expect((await screen.findByText('Projeto não encontrado.')).textContent).toBe('Projeto não encontrado.')
    expect(screen.getByRole('link', { name: 'Voltar para projetos' }).getAttribute('href')).toBe('/projetos')
    missing.unmount()

    const old = deferred<ProjectDetail | null>()
    getProject.mockReset().mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...project, id: 'p2', name: 'Projeto p2' })
    renderNavigablePage()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    expect((await screen.findByRole('heading', { name: 'Projeto p2' })).textContent).toBe('Projeto p2')
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
    await act(async () => {
      old.resolve({ ...project, name: 'Projeto antigo' })
      await old.promise
    })
    expect(screen.queryByRole('heading', { name: 'Projeto antigo' })).toBeNull()
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
  })

  it('não preserva snapshot de outro ID quando o carregamento da nova rota falha', async () => {
    getProject.mockResolvedValueOnce(project).mockRejectedValueOnce(new Error('Falha ao carregar p2.'))
    renderNavigablePage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    expect((await screen.findByText('Falha ao carregar p2.')).textContent).toBe('Falha ao carregar p2.')
    expect(screen.queryByRole('heading', { name: 'Site da Empresa' })).toBeNull()
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
  })

  it('descarta resposta de status quando a rota e o request mudaram', async () => {
    const status = deferred<ProjectDetail>()
    getProject.mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, id: 'p2', name: 'Projeto p2' })
    setProjectStatus.mockReturnValueOnce(status.promise)
    renderNavigablePage()
    fireEvent.change(await screen.findByLabelText('Status do projeto'), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'completed'))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    expect((await screen.findByRole('heading', { name: 'Projeto p2' })).textContent).toBe('Projeto p2')
    await act(async () => {
      status.resolve({ ...project, status: 'completed' })
      await status.promise
    })
    expect(screen.getByRole('heading', { name: 'Projeto p2' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Site da Empresa' })).toBeNull()
    expect(toast).not.toHaveBeenCalledWith('Status do projeto atualizado.')
    expect(screen.queryByText('Carregando projeto…')).toBeNull()
  })

  it('descarta aba, edição e confirmação de status sincronicamente na troca de rota', async () => {
    getProject.mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, id: 'p2', name: 'Projeto p2' })
    renderNavigablePage()
    await screen.findByRole('heading', { name: 'Site da Empresa' })

    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas' }))
    await screen.findByText('Nenhuma tarefa cadastrada.')
    fireEvent.click(screen.getByRole('button', { name: 'Editar projeto' }))
    expect(screen.getByRole('dialog', { name: 'Editar projeto' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Visão' }))
    fireEvent.change(screen.getByLabelText('Status do projeto'), { target: { value: 'completed' } })
    expect(screen.getByRole('dialog', { name: 'Confirmar status' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))

    expect((await screen.findByRole('heading', { name: 'Projeto p2' })).textContent).toBe('Projeto p2')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Visão' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tarefas' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.queryByText('Nenhuma tarefa cadastrada.')).toBeNull()
  })

  it('não libera o saving da rota nova quando o finally de uma mutação antiga termina', async () => {
    const oldStatus = deferred<ProjectDetail>()
    const newStatus = deferred<ProjectDetail>()
    const projectP2: ProjectDetail = { ...project, id: 'p2', name: 'Projeto p2' }
    getProject.mockResolvedValueOnce(project).mockResolvedValueOnce(projectP2).mockResolvedValue(projectP2)
    setProjectStatus.mockReturnValueOnce(oldStatus.promise).mockReturnValueOnce(newStatus.promise)
    renderNavigablePage()

    fireEvent.change(await screen.findByLabelText('Status do projeto'), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p1', 'completed'))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir p2' }))
    await screen.findByRole('heading', { name: 'Projeto p2' })

    fireEvent.change(screen.getByLabelText('Status do projeto'), { target: { value: 'completed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar status' }))
    await waitFor(() => expect(setProjectStatus).toHaveBeenCalledWith('p2', 'completed'))
    expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).disabled).toBe(true)

    await act(async () => {
      oldStatus.resolve({ ...project, status: 'completed' })
      await oldStatus.promise
    })
    expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).disabled).toBe(true)
    expect(toast).not.toHaveBeenCalledWith('Status do projeto atualizado.')

    await act(async () => {
      newStatus.resolve({ ...projectP2, status: 'completed' })
      await newStatus.promise
    })
    await waitFor(() => expect((screen.getByLabelText('Status do projeto') as HTMLSelectElement).disabled).toBe(false))
    expect(screen.getByRole('heading', { name: 'Projeto p2' })).toBeTruthy()
    expect(toast).toHaveBeenCalledWith('Status do projeto atualizado.')
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/ProjectDetailPage.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the detail page**

Create `src/pages/ProjectDetailPage.tsx`:

```tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, FolderKanban } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ProjectDeliveryPanel } from '../components/projects/ProjectDeliveryPanel'
import { ProjectForm } from '../components/projects/ProjectForm'
import { ProjectRevisionList } from '../components/projects/ProjectRevisionList'
import { ProjectTaskList } from '../components/projects/ProjectTaskList'
import { PROJECT_PRIORITY_LABELS, ProjectPriorityBadge } from '../components/projects/ProjectPriorityBadge'
import { PROJECT_STATUS_LABELS, ProjectStatusBadge } from '../components/projects/ProjectStatusBadge'
import { formatProjectDate } from '../components/projects/ProjectCard'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'
import { formatMoney } from '../lib/money'
import { getProject, setProjectStatus } from '../services/projectService'
import {
  PROJECT_MOVE_STATUSES, type ProjectDetail, type ProjectMoveStatus,
} from '../types/project'
import type { ClientActivity } from '../types/client'

type TabKey = 'overview' | 'tasks' | 'revisions' | 'delivery' | 'history'
type ProjectLoadState =
  | { status: 'loading' }
  | { status: 'ready'; project: ProjectDetail }
  | { status: 'empty' }
  | { status: 'error'; message: string; project: ProjectDetail | null }

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Visão' }, { key: 'tasks', label: 'Tarefas' },
  { key: 'revisions', label: 'Revisões' }, { key: 'delivery', label: 'Entrega' },
  { key: 'history', label: 'Histórico' },
]
const ACTIVITY_LABELS: Record<ClientActivity['type'], string> = {
  conversion: 'Conversão', contact: 'Contato', meeting: 'Reunião', approval: 'Aprovação',
  status_change: 'Mudança de status', delivery: 'Entrega', financial: 'Financeiro', note: 'Nota',
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC',
  }).format(date)
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isMoveStatus(value: string): value is ProjectMoveStatus {
  return (PROJECT_MOVE_STATUSES as readonly string[]).includes(value)
}

function ProjectNotFound() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Projeto não encontrado."
      description="O projeto pode ter sido removido ou você não tem acesso a ele."
      action={(
        <Link
          to="/projetos"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Voltar para projetos
        </Link>
      )}
    />
  )
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <ProjectNotFound />
  return <ProjectDetailContent key={id} projectId={id} />
}

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<ProjectLoadState>({ status: 'loading' })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ProjectMoveStatus | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const mountedRef = useRef(false)
  const requestRef = useRef(0)
  const statusMutationRef = useRef(0)
  const savingStatusRef = useRef(false)

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current += 1
      statusMutationRef.current += 1
    }
  }, [])

  const loadProject = useCallback(async (): Promise<void> => {
    const request = ++requestRef.current
    try {
      const project = await getProject(projectId)
      if (!mountedRef.current || request !== requestRef.current) return
      if (!project) setLoadState({ status: 'empty' })
      else setLoadState({ status: 'ready', project })
    } catch (error) {
      if (!mountedRef.current || request !== requestRef.current) return
      const message = errorMessage(error, 'Não foi possível carregar o projeto. Tente novamente.')
      setLoadState((current) => {
        const retained = current.status === 'ready' || current.status === 'error'
          ? current.project
          : null
        return {
          status: 'error', message,
          project: retained?.id === projectId ? retained : null,
        }
      })
    } finally {
      if (mountedRef.current && request === requestRef.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadProject()
  }, [loadProject])

  const currentProject = (loadState.status === 'ready' || loadState.status === 'error')
    && loadState.project?.id === projectId ? loadState.project : null
  const refresh = () => {
    setLoading(true)
    void loadProject()
  }
  const retry = () => {
    setLoading(true)
    setLoadState({ status: 'loading' })
    void loadProject()
  }
  const childChanged = refresh

  const confirmStatus = async () => {
    const project = currentProject
    const status = pendingStatus
    if (!project || !status || savingStatusRef.current) return
    const mutationProjectId = project.id
    const request = requestRef.current
    const mutation = ++statusMutationRef.current
    savingStatusRef.current = true
    setSavingStatus(true)
    let confirmed = false
    try {
      const updated = await setProjectStatus(mutationProjectId, status)
      if (
        !mountedRef.current || request !== requestRef.current
        || mutation !== statusMutationRef.current
      ) return
      setLoadState((current) => {
        if (
          (current.status !== 'ready' && current.status !== 'error')
          || current.project?.id !== mutationProjectId
        ) return current
        return { status: 'ready', project: { ...current.project, ...updated } }
      })
      setPendingStatus(null)
      toast('Status do projeto atualizado.')
      confirmed = true
    } catch (error) {
      if (
        mountedRef.current && request === requestRef.current
        && mutation === statusMutationRef.current
      ) {
        toast(errorMessage(error, 'Não foi possível atualizar o status.'), 'error')
      }
    } finally {
      if (mountedRef.current && mutation === statusMutationRef.current) {
        savingStatusRef.current = false
        setSavingStatus(false)
      }
    }
    if (confirmed && mountedRef.current && request === requestRef.current) {
      setLoading(true)
      await loadProject()
    }
  }

  if (loadState.status === 'loading' || (loading && !currentProject)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-64" />
        <span className="sr-only">Carregando projeto…</span>
      </div>
    )
  }

  if (loadState.status === 'empty' || (!currentProject && loadState.status !== 'error')) {
    return <ProjectNotFound />
  }

  if (!currentProject) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
        <p className="text-sm text-danger">{loadState.status === 'error' ? loadState.message : 'Projeto indisponível.'}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" onClick={retry}>Tentar novamente</Button>
          <Link
            to="/projetos"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Voltar para projetos
          </Link>
        </div>
      </div>
    )
  }

  const project = currentProject
  const activities = [...project.activities].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-primary" to="/projetos">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para projetos
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={loading} onClick={refresh}>Atualizar</Button>
          {project.status !== 'cancelled' && (
            <Button type="button" variant="mint" onClick={() => setEditOpen(true)}>Editar projeto</Button>
          )}
        </div>
      </header>

      {loadState.status === 'error' && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4" role="alert">
          <p className="text-sm text-danger">{loadState.message}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={refresh}>Tentar novamente</Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-line" role="tablist" aria-label="Seções do projeto">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`project-tab-${item.key}`}
            aria-controls={`project-panel-${item.key}`}
            aria-selected={tab === item.key}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === item.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" id={`project-panel-${tab}`} aria-labelledby={`project-tab-${tab}`}>
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">Visão geral</h2>
                  <p className="mt-1 text-sm text-muted">{project.description || 'Sem descrição.'}</p>
                </div>
                {project.status !== 'delivered' && (
                  <Select
                    label="Status do projeto"
                    value={project.status}
                    options={PROJECT_MOVE_STATUSES.map((status) => ({ value: status, label: PROJECT_STATUS_LABELS[status] }))}
                    disabled={savingStatus}
                    onChange={(event) => {
                      if (isMoveStatus(event.target.value) && event.target.value !== project.status) {
                        setPendingStatus(event.target.value)
                      }
                    }}
                  />
                )}
              </div>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted">Cliente</dt><dd className="mt-1"><Link className="font-medium text-primary hover:underline" to={`/clientes/${project.client_id}`}>{project.client_name || project.client_id}</Link></dd></div>
                <div><dt className="text-xs text-muted">Contrato</dt><dd className="mt-1 break-all text-ink">{project.contract_id}</dd></div>
                <div><dt className="text-xs text-muted">Serviço</dt><dd className="mt-1 text-ink">{project.service}</dd></div>
                <div><dt className="text-xs text-muted">Responsável</dt><dd className="mt-1 text-ink">{project.responsible_name || 'Não definido'}</dd></div>
                <div><dt className="text-xs text-muted">Início</dt><dd className="mt-1 text-ink">{formatProjectDate(project.start_date)}</dd></div>
                <div><dt className="text-xs text-muted">Prazo</dt><dd className="mt-1 text-ink">{formatProjectDate(project.due_date)}</dd></div>
              </dl>
            </Card>
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-bold text-ink">Execução</h2>
              <div><p className="text-xs text-muted">Valor alocado</p><p className="mt-1 text-xl font-bold text-ink">{formatMoney(project.contracted_value_cents)}</p></div>
              <div><p className="text-xs text-muted">Prioridade</p><p className="mt-1 text-ink">{PROJECT_PRIORITY_LABELS[project.priority]}</p></div>
              {project.progressPercent === null ? (
                <p className="text-sm text-muted">Sem tarefas ativas</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted">Progresso</span><span className="font-semibold text-ink">{project.progressPercent}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Progresso do projeto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progressPercent}>
                    <div className="h-full bg-primary" style={{ width: `${project.progressPercent}%` }} />
                  </div>
                  <p className="text-xs text-muted">{project.completedTasks} de {project.activeTasks} tarefas concluídas</p>
                </>
              )}
              {project.status === 'cancelled' && <p className="text-sm text-muted">Projeto cancelado. O histórico continua disponível e as criações estão desabilitadas.</p>}
            </Card>
          </div>
        )}
        {tab === 'tasks' && <ProjectTaskList projectId={project.id} onChanged={childChanged} disabled={project.status === 'cancelled'} />}
        {tab === 'revisions' && <ProjectRevisionList projectId={project.id} onChanged={childChanged} disabled={project.status === 'cancelled'} />}
        {tab === 'delivery' && (
          <ProjectDeliveryPanel
            project={project}
            onDelivered={(delivered) => {
              if (delivered.id === projectId) childChanged()
            }}
          />
        )}
        {tab === 'history' && (
          activities.length === 0 ? (
            <EmptyState icon={FolderKanban} title="Nenhuma atividade registrada." description="As mudanças confirmadas do projeto aparecerão aqui." />
          ) : (
            <ol className="flex flex-col gap-3">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase text-primary">{ACTIVITY_LABELS[activity.type]}</span>
                    <time className="text-xs text-muted" dateTime={activity.created_at}>{formatDateTime(activity.created_at)}</time>
                  </div>
                  <p className="mt-2 text-sm text-ink">{activity.description}</p>
                </li>
              ))}
            </ol>
          )
        )}
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar projeto" wide>
        <ProjectForm
          project={project}
          onCancel={() => setEditOpen(false)}
          onSaved={(saved) => {
            if (!mountedRef.current || saved.id !== projectId) return
            setEditOpen(false)
            toast('Projeto atualizado.')
            refresh()
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title="Confirmar status"
        description={pendingStatus ? `Alterar o status para “${PROJECT_STATUS_LABELS[pendingStatus]}”? Esta ação não modifica contrato, pagamento ou receita.` : ''}
        confirmLabel="Confirmar status"
        loading={savingStatus}
        onConfirm={() => void confirmStatus()}
        onCancel={() => { if (!savingStatusRef.current) setPendingStatus(null) }}
      />
    </div>
  )
}
```

O wrapper `ProjectDetailContent key={id}` descarta sincronicamente abas, diálogos e identidade de requests/mutações na troca de projeto. O retorno de `setProjectStatus` só atualiza o estado visível; métricas, tarefas, revisões e histórico sempre vêm do refresh completo de `getProject`. Nenhuma aba importa serviços financeiros.

O snapshot de atualização só é preservado quando pertence ao `projectId` atual; respostas de load e status são ignoradas se montagem, request ou mutação mudaram. O token de mutação impede que o `finally` de uma operação antiga libere o estado de saving da rota nova. Projetos cancelados não exibem “Editar projeto”; a reativação continua disponível pelo seletor de status.

- [ ] **Step 4: Run tests and build**

Run: `npm test -- src/pages/ProjectDetailPage.test.tsx && npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectDetailPage.tsx src/pages/ProjectDetailPage.test.tsx
git commit -m "feat: adicionar detalhe do projeto"
```

---

### Task 12: Registrar rotas, documentar e verificar o Plano 2

**Files:**
- Modify: `src/routes/AppRoutes.tsx`
- Modify: `src/routes/AppRoutes.test.tsx`
- Modify: `src/pages/ModulePlaceholderPage.tsx`
- Modify: `src/pages/ModulePlaceholderPage.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Produces: protected routes `/clientes`, `/clientes/novo`, `/clientes/:id`, `/projetos`, `/projetos/novo` and `/projetos/:id`; Financeiro and Relatórios remain placeholders.

## Controller addendum — prioridade sobre o trecho literal

- O escopo fica restrito aos cinco arquivos listados acima. Não altere componentes, serviços, migrations, dependências, rotas fora do trecho indicado ou documentos diferentes do README.
- Remova o placeholder de Projetos, registre `/projetos`, `/projetos/novo` e `/projetos/:id` e preserve a rota estática `/projetos/novo` antes da dinâmica.
- No README, não use emojis. Relatórios pertence à Etapa 3 · Finalização, não à Etapa 4; mantenha Financeiro e Relatórios como placeholders e declare apenas o que foi implementado.
- As migrations `0006`/`0007`/`0008` já foram aplicadas e a importação/Pipeline foram validados no ambiente remoto. Não volte a afirmar que a aplicação está pendente; mantenha pendente somente a validação SQL autenticada completa e o isolamento RLS entre dois usuários, que não têm evidência atual.
- Preserve todos os limites de segurança: Supabase Free, chave pública no frontend, RLS por proprietário, nenhum dado fictício, nenhuma receita criada por projeto e nenhuma automação de mensagens.
- Escreva/ajuste os testes primeiro e execute o RED esperado antes da implementação. Depois execute GREEN focado, suíte completa, build, lint e diff checks; registre comandos e resultados no relatório.
- Não execute migrations, não afirme validação autenticada/RLS entre dois usuários sem evidência e não marque verificações de navegador como feitas se não foram realizadas. A verificação visual ficará com o controller.
- Faça commits pequenos e frequentes somente com os cinco arquivos autorizados. Não faça push, deploy, alterações no Supabase nem dispare subagentes.

- [ ] **Step 1: Write failing route tests**

Parta integralmente do harness completo de `src/routes/AppRoutes.test.tsx` do Plano 1 e acrescente os stubs/casos de Projetos abaixo. Preserve todas as rotas existentes, `/login` e `/status` públicas, o redirecionamento de rota protegida sem autenticação e a 404; os mocks evitam qualquer acesso ao Supabase. `src/routes/ProtectedRoute.test.tsx` permanece no Plano 1 e não é criado, alterado nem adicionado ao commit desta task.

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
vi.mock('../pages/ProjectsPage', () => ({ ProjectsPage: () => <h1>Projetos</h1> }))
vi.mock('../pages/ProjectNewPage', () => ({ ProjectNewPage: () => <h1>Novo projeto</h1> }))
vi.mock('../pages/ProjectDetailPage', () => ({ ProjectDetailPage: () => <h1>Detalhe do projeto</h1> }))
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
    ['/projetos', 'Projetos'],
    ['/projetos/novo', 'Novo projeto'],
    ['/projetos/project-1', 'Detalhe do projeto'],
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

  it('redireciona rota de projeto para login sem autenticação', () => {
    routeState.authenticated = false
    renderPath('/projetos')

    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Projetos' })).toBeNull()
  })

  it('usa a página 404 para caminho desconhecido', () => {
    renderPath('/rota-inexistente')
    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeTruthy()
    expect(screen.queryByText('Rota protegida')).toBeNull()
  })

  it('não usa mais placeholders para Clientes ou Projetos', () => {
    renderPath('/projetos')
    expect(screen.queryByRole('heading', { name: 'Módulo projetos' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Módulo clientes' })).toBeNull()
  })

  it('mantém /projetos/novo antes da rota dinâmica de detalhe', () => {
    renderPath('/projetos/novo')
    expect(screen.getByRole('heading', { name: 'Novo projeto' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Detalhe do projeto' })).toBeNull()
  })
})
```

Replace `src/pages/ModulePlaceholderPage.test.tsx` with the complete file:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModulePlaceholderPage } from './ModulePlaceholderPage'

const modules = [
  {
    moduleKey: 'financeiro',
    title: 'Financeiro',
    stage: 'Etapa 3',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 3, pelo Plano 3.',
    actionLabel: 'Voltar ao dashboard',
    actionTo: '/',
  },
  {
    moduleKey: 'relatorios',
    title: 'Relatórios',
    stage: 'Etapa 3',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 3, no plano de finalização.',
    actionLabel: 'Ir para Financeiro',
    actionTo: '/financeiro',
  },
] as const

function renderModule(moduleKey: typeof modules[number]['moduleKey']) {
  return render(
    <MemoryRouter initialEntries={[`/modulos/${moduleKey}`]}>
      <Routes>
        <Route path="/modulos/:moduleKey" element={<ModulePlaceholderPage moduleKey={moduleKey} />} />
        <Route path="/" element={<h1>Dashboard</h1>} />
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
  it.each(modules)('$title usa a chave $moduleKey, explica a $stage e possui o CTA correto', ({ moduleKey, title, stage, description, actionLabel, actionTo }) => {
    const { container } = renderModule(moduleKey)
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

  it('o CTA financeiro volta ao dashboard em vez de apontar para si mesmo', () => {
    renderModule('financeiro')
    expect(screen.getByRole('link', { name: 'Voltar ao dashboard' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('link', { name: 'Ir para Financeiro' })).toBeNull()
  })

  it('o CTA financeiro navega para o dashboard', async () => {
    renderModule('financeiro')
    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
  })

  it('somente Relatórios possui CTA para o módulo financeiro', async () => {
    renderModule('relatorios')
    fireEvent.click(screen.getByRole('link', { name: 'Ir para Financeiro' }))
    expect(await screen.findByRole('heading', { name: 'Módulo financeiro' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/routes/AppRoutes.test.tsx src/pages/ModulePlaceholderPage.test.tsx`
Expected: FAIL because Projetos is still a placeholder and the Financeiro CTA still points to `/leads` instead of the dashboard.

- [ ] **Step 3: Implement routes and incremental documentation**

Replace `src/routes/AppRoutes.tsx` with the complete file:

```tsx
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
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectNewPage } from '../pages/ProjectNewPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
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
          <Route path="/projetos" element={<ProjectsPage />} />
          <Route path="/projetos/novo" element={<ProjectNewPage />} />
          <Route path="/projetos/:id" element={<ProjectDetailPage />} />
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

Replace `src/pages/ModulePlaceholderPage.tsx` with the complete file. Clientes and Projetos are no longer placeholders; Financeiro points to Plan 3 and its CTA returns to the dashboard, while only Relatórios links to `/financeiro`.

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Wallet, type LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

const MODULES = {
  financeiro: {
    title: 'Financeiro',
    description: 'Valores contratados e recebidos, separados dos estimados, chegam na Etapa 3, pelo Plano 3.',
    stage: 'Etapa 3',
    icon: Wallet,
    actionLabel: 'Voltar ao dashboard',
    actionTo: '/',
  },
  relatorios: {
    title: 'Relatórios',
    description: 'Relatórios de conversão, nichos e desempenho chegam na Etapa 3, no plano de finalização.',
    stage: 'Etapa 3',
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

Replace `README.md` with the complete content below. It records implementation status without claiming that the pending authenticated migration/RLS checks have run.

````markdown
# Ber CRM — CRM de Prospecção Comercial

CRM profissional construído por etapas, 100% em planos gratuitos.

**Etapa atual: 3 — Planos 1 (Clientes) e 2 (Projetos) implementados; Plano 3 (Financeiro) pendente.**
O CRM inclui Leads / Prospecção, Oportunidades, Pipeline Kanban, Follow-ups, Dashboard,
Configurações, Clientes com contratos e Projetos com tarefas, revisões, histórico e entrega.
Financeiro e Relatórios continuam como placeholders. As migrations `0001`–`0008` já foram
aplicadas no ambiente Supabase atual. A validação SQL autenticada completa das migrations
`0006`–`0008` e o isolamento RLS entre dois usuários permanecem pendentes até execução real
com as contas de teste.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router v7
- Supabase Free (PostgreSQL + Auth)
- Lucide Icons · Montserrat (títulos) + Roboto (texto)
- Deploy: Vercel Hobby + GitHub

## Execução local

Pré-requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev
```

O app abre em `http://localhost:5173`. Sem as chaves do Supabase, o app funciona
em modo diagnóstico: a página `/status` mostra o que falta configurar.

Outros comandos:

```bash
npm test          # testes unitários (Vitest)
npm run build     # typecheck + build de produção (dist/)
npm run preview   # serve o build localmente
npm run lint      # lint
```

## Configuração do Supabase (obrigatório para login)

Projeto Supabase: `nuzjlizqdldhygsliwwc`

1. **Copie a chave pública**: acesse
   [Dashboard → Settings → API Keys](https://supabase.com/dashboard/project/nuzjlizqdldhygsliwwc/settings/api-keys)
   e copie a chave **anon public** (ou a **publishable key**).
2. **Preencha o `.env.local`** na raiz do projeto (já criado, fora do git):

   ```env
   VITE_SUPABASE_URL=https://nuzjlizqdldhygsliwwc.supabase.co
   VITE_SUPABASE_ANON_KEY=<sua chave pública aqui>
   ```

   Reinicie o dev server após editar.
3. **Execute o schema em um novo ambiente**: abra o [SQL Editor](https://supabase.com/dashboard/project/nuzjlizqdldhygsliwwc/sql/new)
   e execute, nesta ordem, [`0001_profiles.sql`](supabase/migrations/0001_profiles.sql),
   [`0002_etapa2.sql`](supabase/migrations/0002_etapa2.sql),
   [`0003_duplicate_canonical.sql`](supabase/migrations/0003_duplicate_canonical.sql),
   [`0004_followup_atomic.sql`](supabase/migrations/0004_followup_atomic.sql),
   [`0005_followup_rpc_json.sql`](supabase/migrations/0005_followup_rpc_json.sql),
   [`0006_etapa3_clients.sql`](supabase/migrations/0006_etapa3_clients.sql),
   [`0007_lead_maps_url.sql`](supabase/migrations/0007_lead_maps_url.sql) e
   [`0008_etapa3_projects.sql`](supabase/migrations/0008_etapa3_projects.sql).
   As migrations criam tabelas privadas, índices, políticas RLS, triggers e RPCs transacionais.
   No ambiente Supabase atual do projeto, as migrations `0001`–`0008` já foram aplicadas.
4. **Crie seu usuário**: Dashboard → Authentication → Users → *Add user* →
   informe e-mail e senha (marque *Auto Confirm User*). Não há cadastro público.
5. Acesse `/status` no app para validar tudo, depois faça login em `/login`.
6. Com uma sessão autenticada, execute os testes SQL
   [`etapa3_clients.sql`](supabase/tests/etapa3_clients.sql) e
   [`etapa3_projects.sql`](supabase/tests/etapa3_projects.sql). Só marque a validação
   de RLS entre dois usuários como concluída após testar duas sessões distintas.

### Segurança

- Apenas a chave **pública** (anon/publishable) é usada no frontend.
  **Nunca** coloque a `service_role` key no `.env.local` ou no código.
- RLS ativo nas tabelas privadas com `owner_id = auth.uid()`; a validação cruzada
  com dois usuários está pendente até a execução autenticada dos testes.
- Rotas internas protegidas por sessão; sem sessão → redireciona para `/login`.
- `.env.local` está no `.gitignore` — credenciais nunca vão para o GitHub.

## Estrutura do projeto

```
src/
  components/
    ui/           Button, Input, Select, Card, Modal, ConfirmDialog, Toast, Spinner…
    auth/         telas de autenticação
    leads/        LeadForm, LeadFiltersBar, LeadChecklist, OpportunityPanel, LeadTimeline,
                  LeadFollowups, FollowupDialog, ContactDialog, WhatsAppDialog, CsvImportModal
    clients/      ClientForm e componentes do módulo de clientes
    projects/     ProjectForm, badges, cards, Kanban, tarefas, revisões e entrega
    pipeline/     KanbanCard e KanbanColumn
    followups/    FollowupItem
  pages/          LoginPage, DashboardPage, StatusPage, NotFoundPage, LeadsPage,
                  LeadNewPage, LeadDetailPage, LeadEditPage, OpportunitiesPage,
                  PipelinePage, FollowUpsPage, SettingsPage, ClientsPage, ClientNewPage,
                  ClientDetailPage, ProjectsPage, ProjectNewPage, ProjectDetailPage,
                  ModulePlaceholderPage
  layouts/        AuthLayout (login) e AppLayout (app autenticado, sidebar + drawer mobile)
  hooks/          useAuth, useToast, useProjectStatusQueue
  services/       authService, leadService, activityService, followupService,
                  digitalCheckService, dashboardService, settingsService, clientService,
                  projectService, projectTaskService, projectRevisionService
  lib/            supabase.ts (cliente único), db.ts, csv.ts, format.ts, leadForm.ts,
                  opportunity.ts, whatsapp.ts, dashboard.ts, pipeline.ts, money.ts,
                  projectProgress.ts (+ testes próprios)
  types/          Profile, Lead, Activity, Followup, Check, Settings, Client, Contract,
                  Project, ProjectTask, ProjectRevision, ClientActivity
  utils/          helpers
  routes/         AppRoutes + ProtectedRoute
supabase/
  migrations/   0001–0008 (profiles, leads, follow-ups, clientes e projetos)
  tests/        etapa3_clients.sql, etapa3_projects.sql e etapa3_task_concurrency.sql
```

Rotas protegidas: `/` (dashboard) · `/leads` · `/leads/novo` · `/leads/:id` ·
`/leads/:id/editar` · `/oportunidades` · `/pipeline` · `/followups` · `/configuracoes` ·
`/clientes` · `/clientes/novo` · `/clientes/:id` · `/projetos` · `/projetos/novo` ·
`/projetos/:id` · `/financeiro` · `/relatorios`. `/login` e `/status` são públicas;
rotas desconhecidas exibem a página 404.

## Fluxo de prospecção

1. **Cadastre o lead** com os dados conhecidos. Presença digital usa três estados:
   `sim`, `não` e `não verificado`; desconhecido nunca é tratado como ausência confirmada.
2. **Verifique a presença digital** e edite o lead quando houver nova informação. O score,
   a prioridade e o valor estimado são recalculados a partir dos dados cadastrados.
3. **Consulte Oportunidades** e use filtros combinados para priorizar o trabalho.
4. **Inicie a prospecção** pela ficha do lead existente. O WhatsApp abre um link `wa.me`
   com mensagem editável; o envio continua sendo manual.
5. **Mova o lead no Pipeline** por arraste ou pelo seletor “Mover para”, no desktop e no
   mobile. A mudança fica registrada no histórico.
6. **Agende Follow-ups**, conclua com resultado e acompanhe os atrasados pelo dashboard
   e pelo sino do cabeçalho.
7. **Converta em cliente**, mantenha contrato e histórico e cadastre projetos vinculados.
8. **Acompanhe projetos** em cards, lista paginada ou Kanban. Tarefas canceladas/excluídas
   ficam fora do denominador; sem tarefas ativas o progresso é `null` (“Sem tarefas ativas”).
9. **Registre revisões e entregas** com confirmação explícita. Concluir ou entregar um projeto
   não cria receita e não altera contrato ou pagamento.

Limites atuais dos planos gratuitos:

- Supabase Free e Vercel Hobby, sem billing, APIs pagas ou automação de mensagens.
- O dashboard usa a contagem exata de leads, mas seus gráficos e indicadores de leads
  (exceto o total) trabalham sobre uma janela de até 1000 registros.
- A lista principal de Oportunidades mostra até 200 registros por consulta; a contagem
  e o potencial indicam quando são parciais. A fila “Prospectar hoje” percorre as páginas
  da consulta elegível antes de ordenar e priorizar. Como usa paginação por offset, escrita
  concorrente durante a leitura pode alterar o conjunto retornado.
- O Pipeline carrega até 500 leads por consulta e a exportação CSV inclui até 1000
  registros do view filtrada; a interface avisa quando há mais resultados.
- Projetos usam 24 itens por página na lista. O Kanban carrega até 500 projetos não
  arquivados e não cancelados e avisa explicitamente quando o resultado é parcial.
- Valores estimados, contratados e recebidos são conceitos distintos. O módulo Financeiro
  será implementado no Plano 3 da Etapa 3; projetos não efetuam mutações financeiras.

## Deploy na Vercel (plano Hobby, gratuito)

1. Suba o código para o GitHub: repositório
   [carboniber-bit/Ber-CRM-Free](https://github.com/carboniber-bit/Ber-CRM-Free).
2. Em [vercel.com](https://vercel.com) → *Add New → Project* → importe o repositório.
3. Framework preset: **Vite** (detectado automaticamente). Build: `npm run build`,
   output: `dist`. O `vercel.json` já cuida do roteamento SPA.
4. Em *Environment Variables*, adicione as mesmas variáveis do `.env.local`:
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave pública).
5. Deploy. Não é necessário nenhum serviço pago nem ativar billing.

> No Supabase, em Authentication → URL Configuration, adicione a URL da Vercel
> em *Site URL* quando o deploy estiver no ar.

## Roadmap por etapas

| Etapa | Escopo | Status |
| ----- | ------ | ------ |
| 1 | Fundação, auth, Supabase, deploy | concluída |
| 2 · Plano 1 | Fundação do CRM: vitest, migration `0002`, types, services, kit UI, sidebar | concluída |
| 2 · Plano 2 | Leads / prospecção: lista, ficha, follow-ups, WhatsApp, CSV | concluída |
| 2 · Plano 3 | Oportunidades, pipeline Kanban, follow-ups, dashboard, configurações | implementado; validação RLS entre 2 usuários pendente |
| 3 · Plano 1 | Clientes, contratos, conversão e histórico | implementado; validação SQL autenticada/RLS pendente |
| 3 · Plano 2 | Projetos, tarefas, revisões, Kanban e entrega | implementado; validação SQL autenticada/RLS pendente |
| 3 · Plano 3 | Financeiro | pendente |
| 3 · Finalização | Relatórios, configurações, backup, segurança e auditoria | pendente |
````

- [ ] **Step 4: Run complete verification**

```bash
npm run build
npm run lint
npm test
git diff --check
```

Expected: all commands exit 0. Fix regressions before proceeding.

- [ ] **Step 5: Controller browser verification**

A verificação abaixo pertence ao controller e não deve ser executada pelo implementador.
As migrations `0006`–`0008` já estão aplicadas no ambiente atual. Com uma sessão
autenticada real, verifique:
1. Create a client/contract and two projects whose allocated values equal but do not exceed the contract.
2. Um terceiro projeto que exceda o contrato é rejeitado com uma mensagem compreensível.
3. Cards, list and Kanban show the same project and progress.
4. Concurrent moves of the same project finish in the last requested status; failed moves roll back only when safe.
5. Add/complete/cancel/delete tasks; progress ignores cancelled/deleted tasks and shows “Sem tarefas ativas” when appropriate.
6. Register, complete and approve a revision; history records approval.
7. Deliver with URL and explicit confirmation; no contract/payment value changes.
8. Client detail project summary reflects the new project.
9. Test 375, 768 and 1280 px; mobile uses selectors and has no horizontal page overflow.

Registre cada verificação de navegador/RLS realmente executada; checks não executados
permanecem pendentes e não devem ser apresentados como evidência.

- [ ] **Step 6: Commit**

```bash
git add src/routes/AppRoutes.tsx src/routes/AppRoutes.test.tsx src/pages/ModulePlaceholderPage.tsx src/pages/ModulePlaceholderPage.test.tsx README.md
git commit -m "feat: concluir modulo de projetos da etapa 3"
```

- [ ] **Step 7: Handoff**

Report exact verification output, browser checks actually performed, migration status and remaining RLS gate. Do not push or deploy without explicit authorization. Plan 3 starts only after this plan is reviewed and accepted.
