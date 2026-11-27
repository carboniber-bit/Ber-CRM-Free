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

commit;
