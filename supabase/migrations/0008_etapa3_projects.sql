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
