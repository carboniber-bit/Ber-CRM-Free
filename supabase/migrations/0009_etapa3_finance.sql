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
