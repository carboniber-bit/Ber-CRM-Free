-- supabase/migrations/0006_etapa3_clients.sql
begin;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = 'public.leads'::regclass and conname = 'leads_owner_id_id_key') then
    alter table public.leads add constraint leads_owner_id_id_key unique (owner_id, id);
  end if;
end
$$;

alter table public.leads
  alter column estimated_value type numeric(14,2) using estimated_value::numeric(14,2),
  alter column negotiated_value type numeric(14,2) using negotiated_value::numeric(14,2),
  alter column contracted_value type numeric(14,2) using contracted_value::numeric(14,2),
  alter column received_value type numeric(14,2) using received_value::numeric(14,2);

create or replace function public.guard_converted_lead_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.lead_client_links where lead_id = old.id and owner_id = old.owner_id) then
    if new.contracted_value is distinct from old.contracted_value then
      raise exception 'CONVERTED_LEAD_CONTRACT_LOCKED' using errcode = '23514';
    end if;
    if new.received_value is distinct from old.received_value then
      raise exception 'CONVERTED_LEAD_RECEIVED_LOCKED' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

alter table public.lead_activities drop constraint if exists lead_activities_type_check;
alter table public.lead_activities add constraint lead_activities_type_check check (type in (
  'primeiro_contato','mensagem','ligacao','resposta','reuniao',
  'proposta','mudanca_status','observacao','follow_up','conversao','outro'
));

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creation_key uuid not null unique,
  name text not null,
  responsible_name text,
  phone text,
  whatsapp text,
  email text,
  cnpj text,
  cnpj_digits text generated always as (
    nullif(pg_catalog.regexp_replace(cnpj, '[^0-9]', '', 'g'), '')
  ) stored,
  phone_canonical text generated always as (public.canonical_phone(phone)) stored,
  whatsapp_canonical text generated always as (public.canonical_phone(whatsapp)) stored,
  website text,
  instagram text,
  address text,
  city text,
  district text,
  zip_code text,
  state text,
  niche text,
  status text not null default 'active' check (status in (
    'active','in_project','awaiting_payment','awaiting_approval','project_completed','inactive'
  )),
  source text not null default 'manual',
  converted_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_owner_id_id_key unique (owner_id, id)
);

create unique index clients_owner_cnpj_idx
  on public.clients (owner_id, cnpj_digits)
  where cnpj_digits is not null;
create index clients_owner_status_idx on public.clients (owner_id, status);
create index clients_owner_name_idx on public.clients (owner_id, name);
create index clients_owner_city_idx on public.clients (owner_id, city);
create index clients_phone_canonical_idx on public.clients (phone_canonical);
create index clients_whatsapp_canonical_idx on public.clients (whatsapp_canonical);
create index clients_created_idx on public.clients (owner_id, created_at desc);

create table public.lead_client_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid not null,
  client_id uuid not null,
  converted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lead_client_links_lead_key unique (lead_id),
  constraint lead_client_links_owner_id_id_key unique (owner_id, id),
  constraint lead_client_links_lead_owner_fk foreign key (owner_id, lead_id)
    references public.leads (owner_id, id) on delete cascade,
  constraint lead_client_links_client_owner_fk foreign key (owner_id, client_id)
    references public.clients (owner_id, id) on delete restrict
);

create trigger leads_guard_converted_financials before update of contracted_value, received_value
  on public.leads for each row execute function public.guard_converted_lead_financials();
revoke all on function public.guard_converted_lead_financials() from public, anon;

create index lead_client_links_client_idx on public.lead_client_links (owner_id, client_id);
create index lead_client_links_created_idx on public.lead_client_links (owner_id, converted_at desc);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  source_link_id uuid,
  creation_key uuid unique,
  service text not null,
  total_value numeric(14,2) not null default 0 check (total_value >= 0),
  contracted_at date not null,
  due_date date,
  payment_method text,
  payment_terms text,
  status text not null default 'active' check (status in ('active','cancelled')),
  notes text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_owner_id_id_key unique (owner_id, id),
  constraint contracts_owner_client_id_key unique (owner_id, client_id, id),
  constraint contracts_source_link_key unique (source_link_id),
  constraint contracts_client_owner_fk foreign key (owner_id, client_id)
    references public.clients (owner_id, id) on delete restrict,
  constraint contracts_source_link_owner_fk foreign key (owner_id, source_link_id)
    references public.lead_client_links (owner_id, id) on delete restrict,
  constraint contracts_due_date_check check (due_date is null or due_date >= contracted_at)
);

create index contracts_owner_status_idx on public.contracts (owner_id, status);
create index contracts_client_idx on public.contracts (owner_id, client_id);
create index contracts_due_idx on public.contracts (owner_id, due_date);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  contract_id uuid not null,
  source_link_id uuid,
  name text not null,
  service text not null,
  contracted_value numeric(14,2) not null default 0 check (contracted_value >= 0),
  description text,
  start_date date,
  due_date date,
  responsible_name text,
  priority text not null default 'medium' check (priority in ('very_high','high','medium','low')),
  status text not null default 'not_started' check (status in (
    'not_started','planning','in_development','awaiting_client_info','in_review',
    'awaiting_approval','changes_requested','completed','delivered','cancelled'
  )),
  completed_at timestamptz,
  delivered_at timestamptz,
  delivery_confirmed_at timestamptz,
  delivery_url text,
  files_url text,
  final_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_owner_id_id_key unique (owner_id, id),
  constraint projects_owner_client_id_key unique (owner_id, client_id, id),
  constraint projects_source_link_key unique (source_link_id),
  constraint projects_contract_owner_fk foreign key (owner_id, client_id, contract_id)
    references public.contracts (owner_id, client_id, id) on delete restrict,
  constraint projects_source_link_owner_fk foreign key (owner_id, source_link_id)
    references public.lead_client_links (owner_id, id) on delete restrict,
  constraint projects_dates_check check (start_date is null or due_date is null or due_date >= start_date)
);

create index projects_owner_status_idx on public.projects (owner_id, status);
create index projects_client_idx on public.projects (owner_id, client_id);
create index projects_contract_idx on public.projects (owner_id, contract_id);
create index projects_due_idx on public.projects (owner_id, due_date);

create table public.client_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  project_id uuid,
  contract_id uuid,
  type text not null check (type in (
    'conversion','contact','meeting','approval','status_change','delivery','financial','note'
  )),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint client_activities_client_owner_fk foreign key (owner_id, client_id)
    references public.clients (owner_id, id) on delete cascade,
  constraint client_activities_project_owner_fk foreign key (owner_id, client_id, project_id)
    references public.projects (owner_id, client_id, id) on delete restrict,
  constraint client_activities_contract_owner_fk foreign key (owner_id, client_id, contract_id)
    references public.contracts (owner_id, client_id, id) on delete restrict,
  constraint client_activities_created_by_check check (created_by is null or created_by = auth.uid())
);

create index client_activities_client_idx on public.client_activities (owner_id, client_id, created_at desc);
create index client_activities_project_idx on public.client_activities (owner_id, project_id, created_at desc);
create index client_activities_contract_idx on public.client_activities (owner_id, contract_id, created_at desc);

alter table public.clients enable row level security;
alter table public.lead_client_links enable row level security;
alter table public.contracts enable row level security;
alter table public.projects enable row level security;
alter table public.client_activities enable row level security;

revoke all on public.clients from anon, authenticated;
revoke all on public.lead_client_links from anon, authenticated;
revoke all on public.contracts from anon, authenticated;
revoke all on public.projects from anon, authenticated;
revoke all on public.client_activities from anon, authenticated;

grant select on public.clients to authenticated;
grant select on public.lead_client_links to authenticated;
grant select on public.contracts to authenticated;
grant select on public.projects to authenticated;
grant select on public.client_activities to authenticated;

create policy clients_select_own on public.clients for select using (auth.uid() = owner_id);
create policy lead_client_links_select_own on public.lead_client_links for select using (auth.uid() = owner_id);
create policy contracts_select_own on public.contracts for select using (auth.uid() = owner_id);
create policy projects_select_own on public.projects for select using (auth.uid() = owner_id);
create policy client_activities_select_own on public.client_activities for select using (auth.uid() = owner_id);

create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

commit;
