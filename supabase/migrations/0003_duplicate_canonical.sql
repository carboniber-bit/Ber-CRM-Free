-- Busca bounded de duplicidades por identificadores canônicos.
-- Aditiva em relação a 0002; não altera RLS ou grants das tabelas.

begin;

create or replace function public.canonical_phone(raw_phone text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  with source as (
    select pg_catalog.regexp_replace(raw_phone, '[^0-9]', '', 'g') as raw_digits
  ),
  normalized as (
    select raw_digits, pg_catalog.regexp_replace(raw_digits, '^0+', '', 'g') as digits
    from source
  )
  select case
    when raw_phone is null or pg_catalog.btrim(raw_phone) = '' or raw_digits = '' then null
    when pg_catalog.length(digits) in (12, 13) and pg_catalog.left(digits, 2) = '55' then digits
    when pg_catalog.length(digits) in (10, 11) then '55' || digits
    else raw_digits
  end
  from normalized
$$;

revoke all on function public.canonical_phone(text) from public;
grant execute on function public.canonical_phone(text) to authenticated;

alter table public.leads
  add column if not exists phone_canonical text
    generated always as (public.canonical_phone(phone)) stored,
  add column if not exists whatsapp_canonical text
    generated always as (public.canonical_phone(whatsapp)) stored,
  add column if not exists cnpj_digits text
    generated always as (nullif(pg_catalog.regexp_replace(cnpj, '[^0-9]', '', 'g'), '')) stored;

create index if not exists leads_phone_canonical_idx
  on public.leads using btree (phone_canonical);
create index if not exists leads_whatsapp_canonical_idx
  on public.leads using btree (whatsapp_canonical);
create index if not exists leads_cnpj_digits_idx
  on public.leads using btree (cnpj_digits);

commit;
