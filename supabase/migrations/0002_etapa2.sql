-- Etapa 2 — leads, atividades, follow-ups, checklist digital e configurações.
-- Execute este arquivo no Supabase Dashboard → SQL Editor.
-- Não altera a tabela profiles da Etapa 1.

-- ============ LEADS ============
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  name text not null,
  responsible_name text,
  niche text,
  phone text,
  whatsapp text,
  email text,
  cnpj text,
  instagram text,
  facebook text,
  website text,
  menu_url text,
  catalog_url text,

  country text default 'Brasil',
  state text,
  city text,
  district text,
  address text,
  zip_code text,

  has_website text not null default 'unverified' check (has_website in ('yes','no','unverified')),
  has_instagram text not null default 'unverified' check (has_instagram in ('yes','no','unverified')),
  has_facebook text not null default 'unverified' check (has_facebook in ('yes','no','unverified')),
  has_digital_menu text not null default 'unverified' check (has_digital_menu in ('yes','no','unverified')),
  has_digital_catalog text not null default 'unverified' check (has_digital_catalog in ('yes','no','unverified')),
  has_landing_page text not null default 'unverified' check (has_landing_page in ('yes','no','unverified')),
  has_business_whatsapp text not null default 'unverified' check (has_business_whatsapp in ('yes','no','unverified')),

  status text not null default 'novo' check (status in (
    'novo','contato_realizado','aguardando_resposta','pediu_informacoes',
    'interessado','negociando','aceitou','ignorou','nao_interessado','follow_up','perdido')),
  offered_service text,
  notes text,
  source text,
  next_contact_at timestamptz,
  last_verified_at timestamptz,

  estimated_value numeric(12,2) not null default 0,
  negotiated_value numeric(12,2) not null default 0,
  contracted_value numeric(12,2) not null default 0,
  received_value numeric(12,2) not null default 0,

  score int not null default 0 check (score between 0 and 100),
  priority text not null default 'baixa' check (priority in ('muito_alta','alta','media','baixa')),
  needs text[] not null default '{}',
  score_reasons jsonb not null default '[]',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_owner_idx on public.leads (owner_id);
create index leads_owner_status_idx on public.leads (owner_id, status);
create index leads_owner_niche_idx on public.leads (owner_id, niche);
create index leads_owner_city_idx on public.leads (owner_id, city);
create index leads_owner_score_idx on public.leads (owner_id, score desc);
create index leads_owner_created_idx on public.leads (owner_id, created_at desc);
create index leads_owner_next_contact_idx on public.leads (owner_id, next_contact_at);

alter table public.leads enable row level security;
grant select, insert, update, delete on public.leads to authenticated;

create policy "leads_select_own" on public.leads for select using (auth.uid() = owner_id);
create policy "leads_insert_own" on public.leads for insert with check (auth.uid() = owner_id);
create policy "leads_update_own" on public.leads for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "leads_delete_own" on public.leads for delete using (auth.uid() = owner_id);

create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- ============ ATIVIDADES (timeline) ============
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in (
    'primeiro_contato','mensagem','ligacao','resposta','reuniao',
    'proposta','mudanca_status','observacao','follow_up','outro')),
  description text not null,
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);
create index lead_activities_owner_idx on public.lead_activities (owner_id, created_at desc);

alter table public.lead_activities enable row level security;
grant select, insert, update, delete on public.lead_activities to authenticated;

create policy "activities_select_own" on public.lead_activities for select using (auth.uid() = owner_id);
create policy "activities_insert_own" on public.lead_activities for insert with check (auth.uid() = owner_id);
create policy "activities_update_own" on public.lead_activities for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "activities_delete_own" on public.lead_activities for delete using (auth.uid() = owner_id);

-- ============ FOLLOW-UPS ============
create table public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  due_at timestamptz not null,
  reason text,
  note text,
  status text not null default 'pendente' check (status in ('pendente','concluido','cancelado')),
  completed_at timestamptz,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_followups_owner_status_due_idx on public.lead_followups (owner_id, status, due_at);
create index lead_followups_lead_idx on public.lead_followups (lead_id, due_at);

alter table public.lead_followups enable row level security;
grant select, insert, update, delete on public.lead_followups to authenticated;

create policy "followups_select_own" on public.lead_followups for select using (auth.uid() = owner_id);
create policy "followups_insert_own" on public.lead_followups for insert with check (auth.uid() = owner_id);
create policy "followups_update_own" on public.lead_followups for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "followups_delete_own" on public.lead_followups for delete using (auth.uid() = owner_id);

create trigger lead_followups_set_updated_at before update on public.lead_followups
  for each row execute function public.set_updated_at();

-- ============ CHECKLIST DE VERIFICAÇÃO DIGITAL ============
create table public.lead_digital_checks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item text not null check (item in ('instagram','website','digital_menu','whatsapp','digital_catalog','business_info')),
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lead_id, item)
);

create index lead_digital_checks_lead_idx on public.lead_digital_checks (lead_id);

alter table public.lead_digital_checks enable row level security;
grant select, insert, update, delete on public.lead_digital_checks to authenticated;

create policy "checks_select_own" on public.lead_digital_checks for select using (auth.uid() = owner_id);
create policy "checks_insert_own" on public.lead_digital_checks for insert with check (auth.uid() = owner_id);
create policy "checks_update_own" on public.lead_digital_checks for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "checks_delete_own" on public.lead_digital_checks for delete using (auth.uid() = owner_id);

-- ============ CONFIGURAÇÕES DO USUÁRIO ============
create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  service_prices jsonb not null default '{"site":0,"landing":0,"cardapio":0,"catalogo":0,"outros":0}',
  whatsapp_template text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
grant select, insert, update, delete on public.user_settings to authenticated;

create policy "settings_select_own" on public.user_settings for select using (auth.uid() = owner_id);
create policy "settings_insert_own" on public.user_settings for insert with check (auth.uid() = owner_id);
create policy "settings_update_own" on public.user_settings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "settings_delete_own" on public.user_settings for delete using (auth.uid() = owner_id);

create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
