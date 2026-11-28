-- supabase/migrations/0009_etapa3_finance.sql
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
    references public.financial_payments (owner_id, contract_id, id) on delete restrict,
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
  if p_installments is null then
    raise exception 'Parcelas devem ser uma lista.' using errcode = '22023';
  end if;
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
  if v_contract.status = 'cancelled' then
    raise exception 'Contrato cancelado não pode ter parcelas alteradas.' using errcode = '23514';
  end if;
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
    from jsonb_array_elements(p_installments) as a(value)
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
    from jsonb_array_elements(p_installments);
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
  from jsonb_array_elements(p_installments) with ordinality;

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
  if v_contract.status = 'cancelled' then
    raise exception 'Contrato cancelado não pode ter o valor ajustado.' using errcode = '23514';
  end if;

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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_owner::text || ':contract:' || p_contract_id::text, 0)
  );
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

commit;
